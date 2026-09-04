/** Centralized combat tuning. Never inline these numbers in systems. */
export const COMBAT = Object.freeze({
  /** Target acquisition runs at 5 Hz rather than every simulation step. */
  acquisitionInterval: 0.2,
  /** Pursuit repathing interval while chasing a live target. */
  repathInterval: 0.5,
  /** Radius searched when an ordered target dies, expressed in world units. */
  retargetRadius: 9,
  /**
   * How far a non-combat Agent will step toward whatever is shooting it. Enough to close on an
   * attacker that outranges it, far too short to be lured away from its job.
   */
  defensivePursuit: 6,
  /** Extra distance a unit may drift beyond its stopping range before repathing. */
  rangeTolerance: 0.35,
  /** Seconds a destruction effect stays visible. */
  deathEffectSeconds: 0.7,
  /** Seconds a shot beam stays visible. */
  shotEffectSeconds: 0.12,
  /** Seconds an impact flash stays visible. */
  impactEffectSeconds: 0.24,
  /** Hard ceiling on simultaneously visible combat effects. */
  maxActiveEffects: 96,
  /** Spatial hash cell size in world units. */
  spatialCellSize: 8,
  /**
   * How far an attacker looks for something to knock down when it cannot reach what it was sent
   * at. Wide enough to find the fence an army has stalled in front of, short enough that it never
   * wanders off to demolish an unrelated outbuilding on the far side of the map.
   */
  breachRadius: 30,
  /** Blocking structures considered per breach search, nearest first. */
  breachCandidates: 4,
});
