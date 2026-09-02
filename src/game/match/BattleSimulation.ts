import { COMBAT } from '../../data/combat';
import { issueAttackCommand } from '../commands/AttackCommand';
import { DamageService, type DeathRecord } from '../combat/DamageService';
import { destroyEntity } from '../combat/destruction';
import { MatchStats } from '../combat/MatchStats';
import { Capacity } from '../economy/Capacity';
import { EconomyLedger } from '../economy/EconomyLedger';
import { GameState } from '../GameState';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { createBattleScenario } from '../scenarios/battle';
import type { EconomyScenario } from '../scenarios/economy';
import { SpatialHash } from '../spatial/SpatialHash';
import { CombatSystem } from '../systems/CombatSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { BUILDING_FOOTPRINT_PADDING } from '../../data/buildings';
import { MAP_BOUNDS, WORLD_OBSTACLES } from '../world/map';
import type { CombatTarget, UnitEntity } from '../types/simulation';
import { MatchState } from './MatchState';

export interface BattleSimulationOptions {
  readonly scenario?: EconomyScenario;
  readonly onShot?: (attacker: UnitEntity, target: CombatTarget) => void;
  readonly onDeath?: (record: DeathRecord) => void;
}

/**
 * Headless twin of the rendered match: movement, combat, damage, destruction, and match end
 * with no Three.js, DOM, or React. Used by the Day 4 battle tests and future AI soak runs.
 */
export class BattleSimulation {
  readonly state = new GameState();
  readonly navigation = new NavigationGrid(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, MAP_BOUNDS.maxX, MAP_BOUNDS.maxZ);
  readonly stats = new MatchStats();
  readonly damage = new DamageService(this.stats);
  readonly match = new MatchState();
  readonly targets = new SpatialHash<CombatTarget>(COMBAT.spatialCellSize);
  readonly movement = new MovementSystem(this.navigation);
  readonly combat: CombatSystem;
  readonly removed: DeathRecord[] = [];

  constructor(private readonly options: BattleSimulationOptions = {}) {
    const scenario = options.scenario ?? createBattleScenario();
    WORLD_OBSTACLES.forEach((obstacle) => this.navigation.setBlockedRect(obstacle.center, obstacle.size, true, 0.65));
    for (const team of ['player', 'enemy'] as const) {
      this.state.economies.set(team, {
        ledger: new EconomyLedger(scenario.startingBalances),
        capacity: new Capacity(scenario.startingBalances.capacity, scenario.units.filter((unit) => unit.team === team).length),
      });
    }
    for (const building of scenario.buildings) {
      this.state.buildings.add(building);
      this.navigation.setBlockedRect(building.position, building.footprint, true, BUILDING_FOOTPRINT_PADDING);
    }
    for (const resource of scenario.resources) this.state.resources.add(resource);
    for (const unit of scenario.units) this.state.units.add(unit);
    this.combat = new CombatSystem({
      targets: this.targets,
      lookup: (id) => this.state.units.get(id) ?? this.state.buildings.get(id),
      damage: this.damage,
      grid: this.navigation,
      onShot: options.onShot,
    });
  }

  step(delta = 1 / 30): void {
    if (this.match.isOver) return;
    this.state.elapsedSeconds += delta;
    this.movement.update(this.state.units.alive(), delta);
    this.targets.sync([...this.state.units.alive(), ...this.state.buildings.alive()]);
    this.combat.update(this.state.units.alive(), delta);
    this.damage.processDeaths((record) => {
      this.removed.push(record);
      this.targets.remove(record.entity.id);
      destroyEntity(record.entity, { state: this.state, navigation: this.navigation });
      if ('footprint' in record.entity && record.entity.kind === 'core') {
        this.match.reportCoreDestroyed(record.entity.team, this.state.elapsedSeconds);
      }
      this.options.onDeath?.(record);
    });
  }

  run(seconds: number, delta = 1 / 30): number {
    const steps = Math.round(seconds / delta);
    let taken = 0;
    for (; taken < steps && !this.match.isOver; taken += 1) this.step(delta);
    return taken;
  }

  attack(units: readonly UnitEntity[], target: CombatTarget): number {
    return issueAttackCommand(units, target, this.navigation).issued;
  }

  unitsOf(team: 'player' | 'enemy'): readonly UnitEntity[] {
    return this.state.units.alive().filter((unit) => unit.team === team);
  }
}
