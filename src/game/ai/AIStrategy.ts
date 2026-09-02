import { AI, aiPhase, desiredWorkers, type AIPhase } from '../../data/ai';

export type AIState = 'EXPAND_ECONOMY' | 'TECH' | 'BUILD_ARMY' | 'SCOUT' | 'DEFEND' | 'ATTACK' | 'RECOVER';

/** Everything the strategy layer is allowed to see. Built once per decision tick. */
export interface AISnapshot {
  readonly elapsedSeconds: number;
  readonly phase: AIPhase;
  readonly matter: number;
  readonly energy: number;
  readonly capacityUsed: number;
  readonly capacityReserved: number;
  readonly capacityMax: number;
  readonly workers: number;
  readonly idleWorkers: number;
  readonly army: number;
  readonly hasCore: boolean;
  readonly fabricators: number;
  readonly relays: number;
  readonly constructionSites: number;
  readonly threatsNearBase: number;
  readonly enemyCoreKnown: boolean;
  readonly scoutActive: boolean;
  readonly secondsSinceScout: number;
  readonly armyLostRecently: number;
  /** How long reinforcement has been impossible, in seconds. Zero while it is still possible. */
  readonly reinforceStalledSeconds: number;
  readonly productionQueued: number;
  readonly peakArmy: number;
  readonly recoveringUntil: number;
}

export interface AIDecision {
  readonly state: AIState;
  readonly scores: Readonly<Record<AIState, number>>;
  readonly reason: string;
}

/**
 * Utility scoring over the seven strategic states. Pure and deterministic: the same snapshot
 * always yields the same decision, which is what the soak seeds depend on.
 */
export function scoreStates(snapshot: AISnapshot): Record<AIState, number> {
  const wanted = desiredWorkers(snapshot.elapsedSeconds);
  const workerDeficit = Math.max(0, wanted - snapshot.workers) / wanted;
  const capacityFree = snapshot.capacityMax - snapshot.capacityUsed - snapshot.capacityReserved;

  return {
    DEFEND: snapshot.threatsNearBase > 0 ? 100 + snapshot.threatsNearBase : 0,
    RECOVER: snapshot.elapsedSeconds < snapshot.recoveringUntil
      || (snapshot.peakArmy >= 3 && snapshot.armyLostRecently / Math.max(1, snapshot.peakArmy) >= AI.recoverLossRatio)
      ? 90
      : 0,
    // A stalled economy must never deadlock the match: commit with a smaller force instead.
    ATTACK: snapshot.enemyCoreKnown && (
      snapshot.army >= AI.attackForce
      || (snapshot.army >= AI.minimumAssault && snapshot.reinforceStalledSeconds >= AI.reinforceStallSeconds && snapshot.productionQueued === 0)
    ) ? 80 : 0,
    SCOUT: !snapshot.enemyCoreKnown && !snapshot.scoutActive && snapshot.secondsSinceScout >= AI.scoutInterval && snapshot.army + snapshot.workers > 3
      ? 70
      : 0,
    BUILD_ARMY: snapshot.fabricators > 0 && capacityFree > 0 && snapshot.army < AI.attackForce ? 55 : 0,
    // Generations arrive with D6-02; until then TECH is a declared placeholder that never wins.
    TECH: 0,
    EXPAND_ECONOMY: 30 + workerDeficit * 40 + (snapshot.fabricators === 0 ? 15 : 0),
  };
}

export function decideState(snapshot: AISnapshot): AIDecision {
  const scores = scoreStates(snapshot);
  const ordered = (Object.keys(scores) as AIState[]).sort((a, b) => scores[b] - scores[a] || a.localeCompare(b));
  const state = ordered[0] ?? 'EXPAND_ECONOMY';
  return { state, scores, reason: reasonFor(state, snapshot) };
}

function reasonFor(state: AIState, snapshot: AISnapshot): string {
  switch (state) {
    case 'DEFEND': return `${snapshot.threatsNearBase} hostiles near base`;
    case 'RECOVER': return `lost ${snapshot.armyLostRecently} of ${snapshot.peakArmy} agents`;
    case 'ATTACK': return snapshot.army >= AI.attackForce
      ? `${snapshot.army} strikers ready, core known`
      : `${snapshot.army} strikers committed, cannot reinforce`;
    case 'SCOUT': return 'enemy core undiscovered';
    case 'BUILD_ARMY': return `${snapshot.army}/${AI.attackForce} strikers`;
    case 'TECH': return 'placeholder until Generations ship';
    default: return `${snapshot.workers}/${desiredWorkers(snapshot.elapsedSeconds)} workers, phase ${aiPhase(snapshot.elapsedSeconds)}`;
  }
}
