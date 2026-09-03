import type { PlaceableBuildingType } from '../building/PlacementController';
import type { UnitTypeId } from '../types/ids';
import type { AITuning } from '../../data/ai';
import type { Random } from '../util/Random';

/**
 * How the opponent opens a match.
 *
 * The complaint this exists to answer is that every game looked identical: a Worker wandered out
 * to find the player, then a Drone, then one army. That was not a bug — nothing in the opponent
 * varied but the seed's effect on placement, so the same script ran every time.
 *
 * A plan is a small set of multipliers and orderings, chosen from the match seed. Difficulty
 * still dominates: a plan shifts what the opponent does first and how it looks for you, never how
 * hard it plays, so relentless stays harder than relaxed under every plan.
 */
export interface OpeningPlan {
  readonly id: string;
  readonly label: string;
  /** Multiplies the phase Worker target. Below 1 opens on military, above 1 on economy. */
  readonly workerScale: number;
  /** Multiplies `earliestAttackSeconds`. Below 1 commits sooner. */
  readonly attackTiming: number;
  /** Multiplies the force required for the opening assault. */
  readonly attackForceScale: number;
  /** Buildings placed ahead of the default plan, in order, before it takes over. */
  readonly buildOrder: readonly PlaceableBuildingType[];
  /** How the opponent looks for the player, tried in order. */
  readonly scoutWith: readonly ('worker' | 'scout' | 'striker')[];
  /** Multiplies `scoutInterval`. Below 1 sweeps more often. */
  readonly scoutCadence: number;
  /**
   * How long, in match seconds, the plan will hold out for one of its preferred scouts before
   * settling for whatever is to hand. Scouting otherwise begins before any military Agent exists,
   * so every opening sent a Worker first no matter what it preferred -- which is exactly the
   * sameness this plan system exists to break.
   */
  readonly scoutPatience: number;
  /** Military production preference ahead of the default striker-heavy mix. */
  readonly unitBias: readonly UnitTypeId[];
  /** Defensive structures the plan wants standing before it masses an army. */
  readonly earlyTurrets: number;
}

/**
 * Five openings that lead to genuinely different early games. Each is viable on its own terms:
 * none of them loses to itself, and none can stall, because they only re-weight decisions the
 * strategy layer already knows how to make.
 */
export const OPENING_PLANS: readonly OpeningPlan[] = Object.freeze([
  {
    id: 'rush',
    label: 'Early pressure',
    workerScale: 0.75,
    attackTiming: 0.6,
    attackForceScale: 0.65,
    buildOrder: ['fabricator'],
    scoutWith: ['striker', 'worker'],
    scoutCadence: 0.7,
    scoutPatience: 40,
    unitBias: ['striker'],
    earlyTurrets: 0,
  },
  {
    id: 'economy',
    label: 'Greedy expansion',
    workerScale: 1.35,
    attackTiming: 1.25,
    attackForceScale: 1.2,
    buildOrder: ['relay', 'habitat', 'relay'],
    scoutWith: ['worker', 'scout'],
    scoutCadence: 1.3,
    scoutPatience: 0,
    unitBias: ['striker'],
    earlyTurrets: 1,
  },
  {
    id: 'fortress',
    label: 'Turtle and tech',
    workerScale: 1.1,
    attackTiming: 1.15,
    attackForceScale: 1.1,
    buildOrder: ['relay', 'depot', 'habitat'],
    scoutWith: ['scout', 'worker'],
    scoutCadence: 1.1,
    scoutPatience: 210,
    unitBias: ['ranger', 'striker'],
    earlyTurrets: 3,
  },
  {
    id: 'recon',
    label: 'Map control',
    workerScale: 1.0,
    attackTiming: 0.95,
    attackForceScale: 0.9,
    buildOrder: ['fabricator', 'outpost'],
    scoutWith: ['scout', 'striker', 'worker'],
    scoutCadence: 0.55,
    scoutPatience: 170,
    unitBias: ['scout', 'ranger', 'striker'],
    earlyTurrets: 1,
  },
  {
    id: 'industry',
    label: 'Heavy industry',
    workerScale: 1.2,
    attackTiming: 1.1,
    attackForceScale: 1.15,
    buildOrder: ['relay', 'fabricator', 'fabricator'],
    scoutWith: ['worker', 'striker'],
    scoutCadence: 1.0,
    scoutPatience: 110,
    unitBias: ['titan', 'ranger', 'striker'],
    earlyTurrets: 2,
  },
]);

/** Picks this match's opening. Seeded, so a fixed seed always plays the same opening. */
export function chooseOpeningPlan(random: Random): OpeningPlan {
  const index = Math.floor(random.next() * OPENING_PLANS.length) % OPENING_PLANS.length;
  return OPENING_PLANS[index] ?? OPENING_PLANS[0]!;
}

/**
 * Folds a plan into a difficulty preset. Difficulty stays dominant: a plan re-weights the same
 * numbers rather than replacing them, so relentless under the greediest opening is still more
 * aggressive than relaxed under the sharpest one.
 */
export function applyOpeningPlan(tuning: AITuning, plan: OpeningPlan): AITuning {
  return {
    ...tuning,
    workers: {
      early: Math.max(4, Math.round(tuning.workers.early * plan.workerScale)),
      mid: Math.max(5, Math.round(tuning.workers.mid * plan.workerScale)),
      late: Math.max(6, Math.round(tuning.workers.late * plan.workerScale)),
    },
    attackForce: Math.max(4, Math.round(tuning.attackForce * plan.attackForceScale)),
    earliestAttackSeconds: Math.round(tuning.earliestAttackSeconds * plan.attackTiming),
  };
}
