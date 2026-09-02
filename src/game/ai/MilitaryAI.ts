import { AI, type AITuning } from '../../data/ai';
import { UNITS } from '../../data/units';
import { MAP_BOUNDS } from '../world/map';
import type { Random } from '../util/Random';
import type { EntityId } from '../types/ids';
import type { CombatTarget, UnitEntity, Vec2 } from '../types/simulation';
import type { AICommands, AIView } from './AIContext';
import { distance, type AIKnowledge } from './AIKnowledge';
import type { AISnapshot, AIState } from './AIStrategy';

export interface MilitaryDebug {
  readonly assembly: Vec2 | null;
  readonly scoutId: EntityId | null;
  /** True only while a scout is still travelling; a parked scout must not block new sweeps. */
  readonly scouting: boolean;
  readonly assaultSize: number;
  readonly launchSize: number;
}

/**
 * Produces Strikers, holds them at an assembly point, scouts for the enemy Core, defends the
 * base, and launches grouped assaults. Orders are re-issued on a cooldown so pursuit never
 * repaths every decision tick.
 */
export class MilitaryAI {
  private assembly: Vec2 | null = null;
  private scoutId: EntityId | null = null;
  private assaultIds = new Set<EntityId>();
  private launchSize = 0;
  private ordersCooldown = 0;
  private scoutTargetIndex = 0;
  private scoutTravelling = false;
  private productionCooldown = 0;

  constructor(private readonly random: Random, private readonly tuning: AITuning) {}

  get debug(): MilitaryDebug {
    return {
      assembly: this.assembly, scoutId: this.scoutId, scouting: this.scoutTravelling,
      assaultSize: this.assaultIds.size, launchSize: this.launchSize,
    };
  }

  update(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState, knowledge: AIKnowledge, delta: number): void {
    this.ordersCooldown = Math.max(0, this.ordersCooldown - delta);
    this.productionCooldown = Math.max(0, this.productionCooldown - delta);
    this.refreshScoutStatus(view);
    this.assembly = this.assemblyPoint(view);
    this.produce(view, commands, snapshot, state);
    this.pruneAssault(view);

    const army = view.units().filter((unit) => unit.kind === 'striker');
    if (state === 'DEFEND') return this.defend(view, commands, army);
    if (state === 'ATTACK') return this.assault(view, commands, army, knowledge);
    if (state === 'SCOUT') this.scout(view, commands, army);
    this.recall(commands, army, state);
  }

  /** A scout that died or arrived is no longer scouting, which lets SCOUT trigger again. */
  private refreshScoutStatus(view: AIView): void {
    if (!this.scoutId) return;
    const scout = view.units().find((unit) => unit.id === this.scoutId);
    if (!scout?.alive) {
      this.scoutId = null;
      this.scoutTravelling = false;
      return;
    }
    this.scoutTravelling = scout.destination !== null;
  }

  private produce(view: AIView, commands: AICommands, snapshot: AISnapshot, state: AIState): void {
    if (state === 'RECOVER' && snapshot.workers < 3) return;
    // Difficulty throttles how attentively the opponent keeps its Fabricators busy.
    if (this.productionCooldown > 0) return;
    const balances = view.balances();
    const cost = UNITS.striker.cost;
    if (balances.matter < (cost.matter ?? 0) || balances.energy < (cost.energy ?? 0)) return;
    const fabricators = view.buildings().filter((building) => building.kind === 'fabricator' && building.operational);
    for (const fabricator of fabricators) {
      if (fabricator.productionQueue.length >= 2) continue;
      const result = commands.produce(fabricator, 'striker');
      if (result.ok) {
        this.productionCooldown = this.tuning.productionInterval;
        return;
      }
      // Capacity or resource shortages are handled by the economy and build slices next tick.
      return;
    }
  }

  private defend(view: AIView, commands: AICommands, army: readonly UnitEntity[]): void {
    const core = view.core();
    if (!core) return;
    const threat = view.hostiles()
      .filter((hostile) => distance(hostile.position, core.position) <= AI.defendRadius)
      .sort((a, b) => distance(a.position, core.position) - distance(b.position, core.position) || a.id.localeCompare(b.id))[0];
    if (!threat) return;
    const defenders = army.filter((unit) => unit.combat.targetId !== threat.id);
    if (defenders.length === 0 || this.ordersCooldown > 0) return;
    this.ordersCooldown = AI.ordersInterval;
    this.assaultIds.clear();
    commands.attack(defenders, threat);
    // Workers defend the base only when there is no army left to do it.
    if (army.length === 0) commands.attack(view.units().filter((unit) => unit.kind === 'worker').slice(0, 3), threat);
  }

  private assault(view: AIView, commands: AICommands, army: readonly UnitEntity[], knowledge: AIKnowledge): void {
    const memory = knowledge.discoveredCore;
    if (!memory) return;
    const target = this.resolveTarget(view, memory.id) ?? this.resolveNearest(view, memory.position);
    if (!target) {
      knowledge.forget(memory.id);
      return;
    }
    if (this.assaultIds.size === 0) {
      const group = army.slice(0, Math.max(1, army.length - AI.defenseReserve));
      this.assaultIds = new Set(group.map((unit) => unit.id));
      this.launchSize = group.length;
    }
    if (this.ordersCooldown > 0) return;
    this.ordersCooldown = AI.ordersInterval;
    const group = army.filter((unit) => this.assaultIds.has(unit.id));
    const needsOrder = group.filter((unit) => unit.combat.targetId === null || !unit.combat.ordered);
    if (needsOrder.length > 0) commands.attack(needsOrder, target);
  }

  private scout(view: AIView, commands: AICommands, army: readonly UnitEntity[]): void {
    const scout = this.scoutId ? view.units().find((unit) => unit.id === this.scoutId) : undefined;
    if (scout?.alive && scout.destination) {
      this.scoutTravelling = true;
      return;
    }
    const candidate = scout?.alive ? scout : army.find((unit) => !this.assaultIds.has(unit.id)) ?? view.units().find((unit) => unit.kind === 'worker' && !unit.buildOrder);
    if (!candidate) {
      this.scoutTravelling = false;
      return;
    }
    this.scoutId = candidate.id;
    if (candidate.kind === 'worker') candidate.automation = null;
    const target = this.nextScoutTarget(view);
    this.scoutTravelling = commands.move([candidate], target) > 0;
  }

  private recall(commands: AICommands, army: readonly UnitEntity[], state: AIState): void {
    if (!this.assembly || this.ordersCooldown > 0) return;
    const idle = army.filter((unit) => (
      unit.id !== this.scoutId && !unit.destination && unit.combat.targetId === null
      && distance(unit.position, this.assembly!) > AI.assemblyRadius
    ));
    if (idle.length === 0) return;
    this.ordersCooldown = AI.ordersInterval;
    if (state === 'RECOVER' || state === 'BUILD_ARMY' || state === 'EXPAND_ECONOMY' || state === 'SCOUT' || state === 'TECH') {
      this.assaultIds.clear();
      commands.move(idle, this.assembly);
    }
  }

  /** Home rally point: just outside the Core, offset toward the middle of the map. */
  private assemblyPoint(view: AIView): Vec2 | null {
    const core = view.core();
    if (!core) return null;
    const towardCentre = Math.hypot(core.position.x, core.position.z) || 1;
    return {
      x: core.position.x - (core.position.x / towardCentre) * AI.assemblyRadius,
      z: core.position.z - (core.position.z / towardCentre) * AI.assemblyRadius,
    };
  }

  private nextScoutTarget(view: AIView): Vec2 {
    const core = view.core();
    const mirrored = core ? { x: -core.position.x, z: -core.position.z } : { x: 0, z: 0 };
    const corners: Vec2[] = [
      mirrored,
      { x: MAP_BOUNDS.minX + 6, z: MAP_BOUNDS.minZ + 6 },
      { x: MAP_BOUNDS.maxX - 6, z: MAP_BOUNDS.maxZ - 6 },
      { x: MAP_BOUNDS.minX + 6, z: MAP_BOUNDS.maxZ - 6 },
      { x: MAP_BOUNDS.maxX - 6, z: MAP_BOUNDS.minZ + 6 },
    ];
    const target = corners[this.scoutTargetIndex % corners.length] ?? mirrored;
    this.scoutTargetIndex += 1;
    return {
      x: target.x + this.random.range(-2, 2),
      z: target.z + this.random.range(-2, 2),
    };
  }

  private pruneAssault(view: AIView): void {
    if (this.assaultIds.size === 0) return;
    const alive = new Set(view.units().map((unit) => unit.id));
    for (const id of [...this.assaultIds]) if (!alive.has(id)) this.assaultIds.delete(id);
    if (this.launchSize > 0 && this.assaultIds.size < this.launchSize * AI.retreatRatio) {
      this.assaultIds.clear();
      this.launchSize = 0;
    }
  }

  private resolveTarget(view: AIView, id: EntityId): CombatTarget | null {
    return view.hostiles().find((hostile) => hostile.id === id) ?? null;
  }

  /** Falls back to whatever hostile structure or unit is nearest the remembered position. */
  private resolveNearest(view: AIView, position: Vec2): CombatTarget | null {
    return view.hostiles()
      .slice()
      .sort((a, b) => distance(a.position, position) - distance(b.position, position) || a.id.localeCompare(b.id))[0] ?? null;
  }

  reset(): void {
    this.assaultIds.clear();
    this.scoutId = null;
    this.scoutTravelling = false;
    this.launchSize = 0;
  }
}
