import { synthesisFor, type SynthesisRecipe } from '../../data/synthesis';
import type { EconomyLedger } from '../economy/EconomyLedger';
import type { EntityId } from '../types/ids';
import type { BuildingEntity } from '../types/simulation';
import { entityPhase } from '../util/phase';

/** What a plant is doing right now, for the selection panel and the AI's read of its colony. */
export type SynthesisStatus = 'running' | 'starved' | 'paused' | 'offline';

/**
 * Manufactured resources: the floor under an economy whose deposits are gone.
 *
 * A plant runs its recipe in whole cycles. At the end of each one the input is charged and the
 * output deposited as a single transaction, so a colony that cannot pay simply does not convert:
 * nothing is half-spent and the plant waits, still charged for the elapsed time, until income
 * arrives. Progress is derived state and lives here rather than on the entity -- a reloaded match
 * restarts its cycles, which costs a couple of seconds and nothing else.
 */
export class SynthesisSystem {
  private readonly progress = new Map<EntityId, number>();

  constructor(private readonly ledgerForTeam: (team: BuildingEntity['team']) => EconomyLedger | undefined) {}

  update(buildings: readonly BuildingEntity[], delta: number): void {
    const seen = new Set<EntityId>();
    for (const building of buildings) {
      const recipe = synthesisFor(building.kind);
      if (!recipe) continue;
      seen.add(building.id);
      if (!building.alive || !building.operational || building.synthesisPaused) continue;
      // A plant's first cycle is offset by its id, so ten plants finished at once do not all
      // charge the ledger on the same simulation step for the rest of the match.
      const elapsed = (this.progress.get(building.id) ?? entityPhase(building.id) * recipe.cycleSeconds) + delta;
      if (elapsed < recipe.cycleSeconds) {
        this.progress.set(building.id, elapsed);
        continue;
      }
      const ledger = this.ledgerForTeam(building.team);
      if (!ledger?.spend(recipe.input)) {
        // Hold at a full cycle: the moment the colony can pay, the next step converts.
        this.progress.set(building.id, recipe.cycleSeconds);
        continue;
      }
      ledger.deposit(recipe.output, recipe.amount);
      this.progress.set(building.id, elapsed - recipe.cycleSeconds);
    }
    // Destroyed plants must not keep a row alive for the rest of the match.
    if (this.progress.size > seen.size) {
      for (const id of this.progress.keys()) if (!seen.has(id)) this.progress.delete(id);
    }
  }

  /** Fraction of the current cycle completed, for the HUD. Zero for anything that is not a plant. */
  cycleProgress(building: BuildingEntity): number {
    const recipe = synthesisFor(building.kind);
    if (!recipe) return 0;
    return Math.min(1, (this.progress.get(building.id) ?? 0) / recipe.cycleSeconds);
  }

  status(building: BuildingEntity): SynthesisStatus {
    const recipe = synthesisFor(building.kind);
    if (!recipe) return 'offline';
    if (!building.alive || !building.operational) return 'offline';
    if (building.synthesisPaused) return 'paused';
    return this.ledgerForTeam(building.team)?.canAfford(recipe.input) ? 'running' : 'starved';
  }

  forget(id: EntityId): void { this.progress.delete(id); }

  clear(): void { this.progress.clear(); }
}

/** Per-second throughput of a recipe, for cost readouts. */
export function synthesisRate(recipe: SynthesisRecipe): number {
  return recipe.amount / recipe.cycleSeconds;
}
