import { describe, it } from 'vitest';
import { createBattleScenario } from '../scenarios/battle';
import { issueAttackCommand } from '../commands/AttackCommand';
import { formatProfile, profileMatch } from './profileMatch';

/**
 * Not an assertion suite — a stopwatch. Skipped by default because the numbers are hardware
 * dependent; unskip it to regenerate the `PERFORMANCE.md` tables:
 *
 * `npx vitest run src/game/debug/profile.test.ts --reporter=verbose`
 */
describe.skip('simulation profile', () => {
  it('reports phase costs for a full AI match', () => {
    console.log(formatProfile(profileMatch({ seed: 10, seconds: 900 })));
  }, 600_000);

  it('reports phase costs for 30-, 60-, and 100-unit battles', () => {
    for (const perSide of [15, 30, 50]) {
      const report = profileMatch({
        seconds: 120,
        opponent: false,
        fixture: createBattleScenario(20_260_904, perSide),
        // Both armies are ordered onto each other's Core, so every unit is pursuing, repathing,
        // acquiring, and shooting at once — the worst case the renderer has to keep up with.
        onStart: (sim) => {
          for (const team of ['player', 'enemy'] as const) {
            const enemyCore = sim.state.buildings.alive().find((b) => b.team !== team && b.kind === 'core');
            const army = sim.state.units.alive().filter((u) => u.team === team);
            if (enemyCore) issueAttackCommand(army, enemyCore, sim.navigation);
          }
        },
      });
      console.log(`\n### ${perSide * 2} units\n\n${formatProfile(report)}`);
    }
  }, 600_000);
});
