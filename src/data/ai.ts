/** Centralized opponent tuning. Balance changes belong here, never inside AI logic. */
export const AI = Object.freeze({
  /** Strategic decisions per second. The PRD caps this at 2–4 Hz. */
  decisionsPerSecond: 3,
  /** Worker targets by match phase. */
  workers: { early: 7, mid: 10, late: 12 },
  earlyPhaseSeconds: 150,
  midPhaseSeconds: 420,
  /** Share of Workers assigned to Energy; the rest gather Matter. */
  energyWorkerRatio: 0.25,
  /** Build a Relay once free capacity drops to this many slots. */
  capacityHeadroom: 3,
  maxRelays: 4,
  maxFabricators: 2,
  /** Ring around the Core used for building placement candidates. */
  buildRingMin: 5.5,
  buildRingMax: 13,
  placementCandidates: 24,
  /** Seconds a build type is skipped after repeated placement failures. */
  placementBackoffSeconds: 6,
  placementFailureLimit: 3,
  /** Strikers required before an assault leaves the assembly point. */
  attackForce: 16,
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
  /** Army share that must be lost inside the loss window to trigger RECOVER. */
  recoverLossRatio: 0.6,
  recoverLossWindowSeconds: 25,
  /** Seconds between scout dispatches while the enemy Core is unknown. */
  scoutInterval: 45,
  /** Multiplier applied to unit vision when deciding what the AI has observed. */
  observationRange: 1,
  /** Distance from the Core where new military units gather. */
  assemblyRadius: 7,
  /** Re-issue army movement orders at most this often, in seconds. */
  ordersInterval: 1.5,
});

export type AIPhase = 'early' | 'mid' | 'late';

export function aiPhase(elapsedSeconds: number): AIPhase {
  if (elapsedSeconds < AI.earlyPhaseSeconds) return 'early';
  return elapsedSeconds < AI.midPhaseSeconds ? 'mid' : 'late';
}

export function desiredWorkers(elapsedSeconds: number): number {
  return AI.workers[aiPhase(elapsedSeconds)];
}
