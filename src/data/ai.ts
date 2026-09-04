/** Centralized opponent tuning. Balance changes belong here, never inside AI logic. */
export const AI = Object.freeze({
  /** Strategic decisions per second. The PRD caps this at 2–4 Hz. */
  decisionsPerSecond: 3,
  earlyPhaseSeconds: 150,
  midPhaseSeconds: 420,
  /** Share of Workers assigned to Energy; the rest gather Matter. */
  energyWorkerRatio: 0.25,
  /** Energy lead over Matter that sends gatherers back to Matter; the build is Matter-heavy. */
  surplusMargin: 260,
  /** Data banked beyond this is idle capital: the colony gathers something else instead. */
  dataTarget: 220,
  /** Workers kept on Data while the colony is still short of its Data target. */
  dataWorkers: 1,
  /** Worker count before any gatherer is spared for Data. */
  dataCrewFrom: 6,
  /** Longest the opponent will hold Matter for its next Generation before giving up on it. */
  techSaveSeconds: 120,
  /** Build a Relay once free capacity drops to this many slots. */
  capacityHeadroom: 3,
  maxFabricators: 2,
  /** Ceilings on the rest of the colony, so the opponent's base fills out instead of stopping. */
  maxTurrets: 5,
  maxHabitats: 3,
  maxDepots: 2,
  /**
   * How far from its Core the opponent counts live deposits before deciding a resource is gone
   * and worth manufacturing instead. Wide enough to include its expansion clusters, short of the
   * contested middle it may not be able to hold.
   */
  synthesisSearchRange: 70,
  /** Plants of each kind the opponent will run. Two is enough to matter without eating its cap. */
  maxPlants: 2,
  /**
   * Wall segments the opponent fences its approach with before Turrets unlock. A segment is four
   * units long, so this is roughly twenty units of fence: enough to shape a raid's approach, and
   * short of the length at which the opponent starts walling its own Workers in.
   */
  maxWalls: 5,
  /** Strikers' worth of Matter held back from the build plan while the army is short. */
  armyReserveStrikers: 2,
  /** Foundations the opponent will keep open at once. One at a time built a base far too slowly. */
  concurrentSites: 2,
  /** Half-angle, in radians, of the arc a Turret is placed within, facing the map's interior. */
  turretArc: 1.0,
  /** Ring around the Core used for building placement candidates. */
  buildRingMin: 5.5,
  buildRingMax: 13,
  placementCandidates: 24,
  /** Seconds a build type is skipped after repeated placement failures. */
  placementBackoffSeconds: 6,
  placementFailureLimit: 3,
  /** Smaller force the AI will still commit with when it can no longer reinforce. */
  minimumAssault: 5,
  /** Reinforcement must be impossible for this long before the fallback assault commits. */
  reinforceStallSeconds: 150,
  /** Strikers kept home while the rest attack. */
  defenseReserve: 2,
  /** Assault is abandoned when the strike group falls below this share of its launch size. */
  retreatRatio: 0.35,
  /** Radius around owned structures that counts as a base threat. */
  defendRadius: 22,
  /** Seconds spent rebuilding after heavy losses before attacking again. */
  recoverSeconds: 30,
  /**
   * Longest the opponent will keep massing between assaults before committing with whatever it
   * has. Without this the required force stays pinned at `attackForce` while the map depletes,
   * so each rebuild takes longer than the last and the gap between waves grows without bound --
   * which from the player's chair is indistinguishable from "it never attacked again".
   */
  reattackSeconds: 150,
  /** Force required for a follow-up assault, as a share of the nominal attack force. */
  reattackForceRatio: 0.6,
  /** Half-life, in seconds, of the peak-army figure the RECOVER loss ratio is measured against. */
  peakArmyHalfLife: 90,
  /** Army share that must be lost inside the loss window to trigger RECOVER. */
  recoverLossRatio: 0.6,
  recoverLossWindowSeconds: 25,
  /** Seconds between scout dispatches while the enemy Core is unknown. */
  scoutInterval: 30,
  /** Multiplier applied to unit vision when deciding what the AI has observed. */
  observationRange: 1,
  /** Distance from the Core where new military units gather. */
  assemblyRadius: 7,
  /** Re-issue army movement orders at most this often, in seconds. */
  ordersInterval: 1.5,
});

export type AIPhase = 'early' | 'mid' | 'late';
export type AIDifficulty = 'relaxed' | 'standard' | 'relentless';

export interface AITuning {
  readonly difficulty: AIDifficulty;
  readonly label: string;
  readonly description: string;
  /** Worker target per match phase. */
  readonly workers: Readonly<Record<AIPhase, number>>;
  /** Strikers required before a planned assault launches. */
  readonly attackForce: number;
  /** Seconds between military production orders; a higher value is a slower opponent. */
  readonly productionInterval: number;
  /** No assault may launch before this point in the match. */
  readonly earliestAttackSeconds: number;
  readonly maxRelays: number;
}

/**
 * Difficulty presets. These are the only numbers that change how hard the opponent plays;
 * its decision-making is identical at every level, so it never cheats to be harder.
 */
export const AI_DIFFICULTY: Readonly<Record<AIDifficulty, AITuning>> = Object.freeze({
  relaxed: {
    difficulty: 'relaxed', label: 'RELAXED', description: 'Builds slowly and attacks late. Room to learn the colony loop.',
    workers: { early: 6, mid: 8, late: 10 }, attackForce: 10,
    productionInterval: 9, earliestAttackSeconds: 960, maxRelays: 4,
  },
  standard: {
    difficulty: 'standard', label: 'STANDARD', description: 'Expands, masses a real army, and commits once it has one.',
    workers: { early: 8, mid: 11, late: 13 }, attackForce: 16,
    productionInterval: 4.5, earliestAttackSeconds: 720, maxRelays: 6,
  },
  relentless: {
    difficulty: 'relentless', label: 'RELENTLESS', description: 'Maximum economy, constant production, early aggression.',
    workers: { early: 10, mid: 14, late: 18 }, attackForce: 13,
    productionInterval: 0, earliestAttackSeconds: 300, maxRelays: 9,
  },
});

export const DEFAULT_DIFFICULTY: AIDifficulty = 'standard';

export function resolveTuning(difficulty: AIDifficulty = DEFAULT_DIFFICULTY): AITuning {
  return AI_DIFFICULTY[difficulty] ?? AI_DIFFICULTY[DEFAULT_DIFFICULTY];
}

export function aiPhase(elapsedSeconds: number): AIPhase {
  if (elapsedSeconds < AI.earlyPhaseSeconds) return 'early';
  return elapsedSeconds < AI.midPhaseSeconds ? 'mid' : 'late';
}

export function desiredWorkers(elapsedSeconds: number, tuning: AITuning): number {
  return tuning.workers[aiPhase(elapsedSeconds)];
}
