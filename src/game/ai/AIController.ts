import { AI, aiPhase, resolveTuning, type AIDifficulty, type AITuning } from '../../data/ai';
import { UNITS } from '../../data/units';
import type { MatchSimulation } from '../match/MatchSimulation';
import { Random } from '../util/Random';
import type { EntityId } from '../types/ids';
import { AIKnowledge, distance } from './AIKnowledge';
import { BuildPlanner } from './BuildPlanner';
import { EconomyAI } from './EconomyAI';
import { MilitaryAI } from './MilitaryAI';
import { createAIContext, type AICommands, type AIView, type PlayableTeam } from './AIContext';
import { decideState, type AIDecision, type AISnapshot, type AIState } from './AIStrategy';

export interface AIControllerOptions {
  readonly seed?: number;
  readonly team?: PlayableTeam;
  readonly difficulty?: AIDifficulty;
  readonly onDecision?: (decision: AIDecision, snapshot: AISnapshot) => void;
}

export interface AIDebugSnapshot {
  readonly state: AIState;
  readonly reason: string;
  readonly decisions: number;
  readonly workers: number;
  readonly army: number;
  readonly matter: number;
  readonly energy: number;
  readonly capacity: string;
  readonly enemyCoreKnown: boolean;
  readonly assaultSize: number;
}

interface LossSample { readonly at: number; readonly lost: number }

/**
 * Deterministic opponent. Strategy runs at AI.decisionsPerSecond, never per render frame, and
 * every action goes through the same commands a human uses.
 */
export class AIController {
  readonly knowledge = new AIKnowledge();
  private readonly view: AIView;
  private readonly commands: AICommands;
  private readonly random: Random;
  readonly tuning: AITuning;
  private readonly economy: EconomyAI;
  private readonly builder: BuildPlanner;
  private readonly military: MilitaryAI;
  private readonly interval = 1 / AI.decisionsPerSecond;
  private readonly losses: LossSample[] = [];
  private accumulator = 0;
  private decisionCount = 0;
  private currentState: AIState = 'EXPAND_ECONOMY';
  private currentReason = 'match start';
  private lastArmy = 0;
  private peakArmy = 0;
  private recoveringUntil = 0;
  private lastScoutAt = -AI.scoutInterval;
  private lastSnapshot: AISnapshot | null = null;
  private reinforceStalledSince: number | null = null;

  constructor(
    simulation: MatchSimulation,
    private readonly options: AIControllerOptions = {},
  ) {
    const context = createAIContext(simulation, options.team ?? 'enemy');
    this.view = context.view;
    this.commands = context.commands;
    this.random = new Random(options.seed ?? 20_260_905);
    this.tuning = resolveTuning(options.difficulty);
    this.economy = new EconomyAI(this.tuning);
    this.builder = new BuildPlanner(this.random, this.tuning);
    this.military = new MilitaryAI(this.random, this.tuning);
  }

  get team(): PlayableTeam { return this.view.team; }
  get state(): AIState { return this.currentState; }
  get decisions(): number { return this.decisionCount; }

  get debug(): AIDebugSnapshot {
    const snapshot = this.lastSnapshot;
    return {
      state: this.currentState,
      reason: this.currentReason,
      decisions: this.decisionCount,
      workers: snapshot?.workers ?? 0,
      army: snapshot?.army ?? 0,
      matter: Math.floor(snapshot?.matter ?? 0),
      energy: Math.floor(snapshot?.energy ?? 0),
      capacity: `${snapshot?.capacityUsed ?? 0}+${snapshot?.capacityReserved ?? 0}/${snapshot?.capacityMax ?? 0}`,
      enemyCoreKnown: this.knowledge.hasDiscoveredCore,
      assaultSize: this.military.debug.assaultSize,
    };
  }

  /** Called every simulation step; only crosses into planning at the decision frequency. */
  update(delta: number): void {
    this.accumulator += delta;
    if (this.accumulator < this.interval) return;
    const step = this.accumulator;
    this.accumulator = 0;
    this.tick(step);
  }

  /** Drops a destroyed entity from AI memory so stale targets are never pursued. */
  forget(id: EntityId): void { this.knowledge.forget(id); }

  private tick(step: number): void {
    const elapsed = this.view.elapsedSeconds;
    this.knowledge.observe([...this.view.units(), ...this.view.buildings()], this.view.hostiles(), elapsed);
    const snapshot = this.buildSnapshot(elapsed);
    this.lastSnapshot = snapshot;
    const decision = decideState(snapshot, this.tuning);
    if (decision.state !== this.currentState) this.onStateChange(decision.state, snapshot);
    this.currentState = decision.state;
    this.currentReason = decision.reason;
    this.decisionCount += 1;
    this.options.onDecision?.(decision, snapshot);

    const scoutId = this.military.debug.scoutId;
    this.economy.update(this.view, this.commands, snapshot, decision.state, scoutId ? new Set([scoutId]) : new Set());
    if (decision.state === 'TECH') this.commands.advance();
    this.builder.update(this.view, this.commands, snapshot, decision.state);
    this.military.update(this.view, this.commands, snapshot, decision.state, this.knowledge, step);
    if (decision.state === 'SCOUT') this.lastScoutAt = elapsed;
  }

  private onStateChange(next: AIState, snapshot: AISnapshot): void {
    if (next === 'RECOVER') this.recoveringUntil = snapshot.elapsedSeconds + AI.recoverSeconds;
    if (next === 'DEFEND' || next === 'RECOVER') this.military.reset();
  }

  private buildSnapshot(elapsed: number): AISnapshot {
    const units = this.view.units();
    const buildings = this.view.buildings();
    const balances = this.view.balances();
    const capacity = this.view.capacity();
    const core = this.view.core();
    const workers = units.filter((unit) => unit.kind === 'worker');
    const army = units.filter((unit) => unit.kind !== 'worker');
    this.trackLosses(army.length, elapsed);

    const defended = buildings.length > 0 ? buildings : core ? [core] : [];
    const threats = this.view.hostiles().filter((hostile) => (
      !('footprint' in hostile) && defended.some((building) => distance(building.position, hostile.position) <= AI.defendRadius)
    ));

    return {
      elapsedSeconds: elapsed,
      phase: aiPhase(elapsed),
      matter: balances.matter,
      energy: balances.energy,
      data: balances.data,
      generation: this.view.generation(),
      capacityUsed: capacity.used,
      capacityReserved: capacity.reserved,
      capacityMax: capacity.max,
      workers: workers.length,
      idleWorkers: workers.filter((worker) => !worker.automation && !worker.gatherOrder && !worker.buildOrder).length,
      army: army.length,
      hasCore: Boolean(core),
      fabricators: buildings.filter((building) => building.kind === 'fabricator' && building.operational).length,
      relays: buildings.filter((building) => building.kind === 'relay').length,
      constructionSites: buildings.filter((building) => !building.operational).length,
      threatsNearBase: threats.length,
      enemyCoreKnown: this.knowledge.hasDiscoveredCore,
      scoutActive: this.military.debug.scouting,
      secondsSinceScout: elapsed - this.lastScoutAt,
      armyLostRecently: this.recentLosses(elapsed),
      reinforceStalledSeconds: this.reinforceStall(this.canReinforce(buildings, balances, capacity), elapsed),
      productionQueued: buildings.reduce((sum, building) => sum + building.productionQueue.length, 0),
      peakArmy: this.peakArmy,
      recoveringUntil: this.recoveringUntil,
    };
  }

  /**
   * Can another Striker still be produced, now or soon? Only a colony that can neither pay for
   * one nor still gather is truly stalled, which is what unlocks the fallback assault.
   */
  private canReinforce(
    buildings: readonly { kind: string; operational: boolean }[],
    balances: { matter: number; energy: number },
    capacity: { used: number; reserved: number; max: number },
  ): boolean {
    const hasFabricator = buildings.some((building) => building.kind === 'fabricator' && building.operational);
    if (!hasFabricator) return true;
    if (capacity.used + capacity.reserved >= capacity.max) return true;
    const cost = UNITS.striker.cost;
    if (balances.matter >= (cost.matter ?? 0) && balances.energy >= (cost.energy ?? 0)) return true;
    // Poverty with live income is temporary; poverty with no gatherers left is not.
    return this.view.units().some((unit) => unit.kind === 'worker' && (unit.gatherOrder || unit.automation))
      && this.view.resources().length > 0;
  }

  private reinforceStall(canReinforce: boolean, elapsed: number): number {
    if (canReinforce) {
      this.reinforceStalledSince = null;
      return 0;
    }
    this.reinforceStalledSince ??= elapsed;
    return elapsed - this.reinforceStalledSince;
  }

  private trackLosses(army: number, elapsed: number): void {
    this.peakArmy = Math.max(this.peakArmy, army);
    const lost = Math.max(0, this.lastArmy - army);
    if (lost > 0) this.losses.push({ at: elapsed, lost });
    this.lastArmy = army;
    while (this.losses.length > 0 && elapsed - this.losses[0]!.at > AI.recoverLossWindowSeconds) this.losses.shift();
  }

  private recentLosses(elapsed: number): number {
    return this.losses
      .filter((sample) => elapsed - sample.at <= AI.recoverLossWindowSeconds)
      .reduce((sum, sample) => sum + sample.lost, 0);
  }
}
