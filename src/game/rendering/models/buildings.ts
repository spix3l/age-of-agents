import * as THREE from 'three';
import { BUILDINGS } from '../../../data/buildings';
import type { BuildingTypeId } from '../../types/ids';
import type { Team } from '../../types/simulation';
import type { ResourceCache } from './palette';

export interface BuildingModel {
  readonly group: THREE.Group;
  /** Parts the renderer animates: orbit rings, dishes, production arms, energy columns. */
  readonly spinners: THREE.Object3D[];
  readonly column: THREE.Object3D | null;
  readonly arm: THREE.Object3D | null;
  readonly pickable: THREE.Object3D[];
  readonly generationParts: readonly { readonly part: THREE.Object3D; readonly min: 2 | 3 }[];
}

function tag(object: THREE.Object3D, id: string, pickable: THREE.Object3D[]): THREE.Object3D {
  object.userData.entityId = id;
  object.castShadow = true;
  object.receiveShadow = true;
  pickable.push(object);
  return object;
}

/** Core: a tiered ziggurat with an energy column and two counter-rotating orbit rings. */
function buildCore(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const spinners: THREE.Object3D[] = [];

  const base = new THREE.Mesh(cache.geometry('core-base', () => new THREE.CylinderGeometry(2.5, 2.9, 0.7, 8)), cache.frame(team));
  base.position.y = 0.35;
  tag(base, id, pickable);

  const tier = new THREE.Mesh(cache.geometry('core-tier', () => new THREE.CylinderGeometry(1.9, 2.4, 0.9, 8)), cache.plate(team));
  tier.position.y = 1.05;
  tag(tier, id, pickable);

  const drum = new THREE.Mesh(cache.geometry('core-drum', () => new THREE.CylinderGeometry(1.3, 1.7, 1.5, 8)), cache.hull(team));
  drum.position.y = 2.15;
  tag(drum, id, pickable);

  const cap = new THREE.Mesh(cache.geometry('core-cap', () => new THREE.CylinderGeometry(1.05, 1.3, 0.4, 8)), cache.plate(team));
  cap.position.y = 3.05;
  tag(cap, id, pickable);

  const column = new THREE.Mesh(cache.geometry('core-column', () => new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8)), cache.glow(team, 2.4));
  column.position.y = 3.6;

  const crown = new THREE.Mesh(cache.geometry('core-crown', () => new THREE.OctahedronGeometry(0.9, 0)), cache.glow(team, 1.4));
  crown.position.y = 5.1;
  tag(crown, id, pickable);

  for (const [index, radius] of [1.9, 2.4].entries()) {
    const ring = new THREE.Mesh(
      cache.geometry(`core-ring-${index}`, () => new THREE.TorusGeometry(radius, 0.07, 6, 28)),
      cache.glow(team, 1.1),
    );
    ring.position.y = 3.4 + index * 0.5;
    ring.rotation.x = Math.PI / 2 + (index === 0 ? 0.24 : -0.18);
    group.add(ring);
    spinners.push(ring);
  }

  // Four buttresses give the silhouette weight from any camera angle.
  for (let index = 0; index < 4; index += 1) {
    const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
    const buttress = new THREE.Mesh(cache.geometry('core-buttress', () => new THREE.BoxGeometry(0.4, 1.8, 0.9)), cache.frame(team));
    buttress.position.set(Math.cos(angle) * 2.1, 0.9, Math.sin(angle) * 2.1);
    buttress.rotation.y = -angle;
    tag(buttress, id, pickable);
    group.add(buttress);
  }

  group.add(base, tier, drum, cap, column, crown);
  const autonomyCrown = new THREE.Mesh(cache.geometry('core-autonomy-crown', () => new THREE.TorusGeometry(1.15, 0.13, 6, 12)), cache.glow(team, 1.4));
  autonomyCrown.position.y = 4.65;
  autonomyCrown.rotation.x = Math.PI / 2;
  autonomyCrown.visible = false;
  const singularityHalo = new THREE.Mesh(cache.geometry('core-singularity-halo', () => new THREE.TorusGeometry(1.65, 0.1, 6, 18)), cache.glow(team, 2));
  singularityHalo.position.y = 5.1;
  singularityHalo.rotation.x = Math.PI / 2;
  singularityHalo.visible = false;
  group.add(autonomyCrown, singularityHalo);
  spinners.push(autonomyCrown, singularityHalo);
  return { group, spinners, column, arm: null, pickable, generationParts: [{ part: autonomyCrown, min: 2 }, { part: singularityHalo, min: 3 }] };
}

/** Relay Node: a mast with a rotating dish and a pulsing signal column. */
function buildRelay(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];
  const spinners: THREE.Object3D[] = [];

  const pad = new THREE.Mesh(cache.geometry('relay-pad', () => new THREE.CylinderGeometry(1, 1.2, 0.4, 6)), cache.frame(team));
  pad.position.y = 0.2;
  tag(pad, id, pickable);

  const housing = new THREE.Mesh(cache.geometry('relay-housing', () => new THREE.BoxGeometry(0.9, 0.7, 0.9)), cache.plate(team));
  housing.position.y = 0.72;
  tag(housing, id, pickable);

  const mast = new THREE.Mesh(cache.geometry('relay-mast', () => new THREE.CylinderGeometry(0.14, 0.22, 2.5, 6)), cache.hull(team));
  mast.position.y = 2.1;
  tag(mast, id, pickable);

  const dishMount = new THREE.Group();
  dishMount.position.y = 3.2;
  const dish = new THREE.Mesh(cache.geometry('relay-dish', () => new THREE.ConeGeometry(0.78, 0.5, 8, 1, true)), cache.hull(team));
  dish.rotation.set(Math.PI * 0.72, 0, 0.3);
  const feed = new THREE.Mesh(cache.geometry('relay-feed', () => new THREE.SphereGeometry(0.13, 6, 5)), cache.glow(team, 2));
  feed.position.set(0, 0.34, -0.3);
  dishMount.add(dish, feed);
  tag(dish, id, pickable);
  spinners.push(dishMount);

  const column = new THREE.Mesh(cache.geometry('relay-column', () => new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6)), cache.glow(team, 1.6));
  column.position.y = 2;

  group.add(pad, housing, mast, dishMount, column);
  return { group, spinners, column, arm: null, pickable, generationParts: [] };
}

/** Fabricator: an assembly hall with a gantry arm that sweeps while production runs. */
function buildFabricator(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group();
  const pickable: THREE.Object3D[] = [];

  const floor = new THREE.Mesh(cache.geometry('fab-floor', () => new THREE.BoxGeometry(3.7, 0.3, 2.7)), cache.frame(team));
  floor.position.y = 0.15;
  tag(floor, id, pickable);

  const hall = new THREE.Mesh(cache.geometry('fab-hall', () => new THREE.BoxGeometry(3.2, 1.5, 2.2)), cache.plate(team));
  hall.position.y = 1;
  tag(hall, id, pickable);

  const roof = new THREE.Mesh(cache.geometry('fab-roof', () => new THREE.CylinderGeometry(1.15, 1.15, 3.1, 6, 1, false, 0, Math.PI)), cache.hull(team));
  roof.rotation.set(0, 0, Math.PI / 2);
  roof.position.y = 1.75;
  tag(roof, id, pickable);

  const vent = new THREE.Mesh(cache.geometry('fab-vent', () => new THREE.CylinderGeometry(0.36, 0.46, 1.1, 6)), cache.frame(team));
  vent.position.set(-1.3, 2.3, 0.6);
  tag(vent, id, pickable);

  const door = new THREE.Mesh(cache.geometry('fab-door', () => new THREE.BoxGeometry(1.5, 1, 0.12)), cache.glow(team, 1.1));
  door.position.set(0, 0.8, -1.14);

  // Gantry arm sweeps across the assembly bay whenever something is being built.
  const arm = new THREE.Group();
  arm.position.set(0, 2.1, 0);
  const rail = new THREE.Mesh(cache.geometry('fab-rail', () => new THREE.BoxGeometry(3.4, 0.14, 0.16)), cache.frame(team));
  const hoist = new THREE.Mesh(cache.geometry('fab-hoist', () => new THREE.BoxGeometry(0.34, 0.5, 0.34)), cache.plate(team));
  hoist.position.y = -0.32;
  const spark = new THREE.Mesh(cache.geometry('fab-spark', () => new THREE.SphereGeometry(0.12, 6, 5)), cache.glow(team, 2.6));
  spark.position.y = -0.62;
  arm.add(rail, hoist, spark);

  group.add(floor, hall, roof, vent, door, arm);
  return { group, spinners: [], column: null, arm, pickable, generationParts: [] };
}

/** Barrier Wall: chunky toy-like cover with glowing status pips. */
function buildWall(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = [];
  const base = new THREE.Mesh(cache.geometry('wall-base', () => new THREE.BoxGeometry(1.9, 0.35, 0.9)), cache.frame(team));
  base.position.y = 0.18; tag(base, id, pickable);
  const slab = new THREE.Mesh(cache.geometry('wall-slab', () => new THREE.BoxGeometry(1.7, 1.25, 0.55)), cache.hull(team));
  slab.position.y = 0.9; tag(slab, id, pickable);
  for (const x of [-0.58, 0, 0.58]) {
    const pip = new THREE.Mesh(cache.geometry('wall-pip', () => new THREE.SphereGeometry(0.11, 6, 4)), cache.glow(team, 1.5));
    pip.position.set(x, 1.42, -0.3); group.add(pip);
  }
  group.add(base, slab);
  return { group, spinners: [], column: null, arm: null, pickable, generationParts: [] };
}

/** Field Outpost: a cheerful rover garage with a lookout eye and resource hatch. */
function buildOutpost(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = []; const spinners: THREE.Object3D[] = [];
  const base = new THREE.Mesh(cache.geometry('outpost-base', () => new THREE.CylinderGeometry(1.55, 1.75, 0.45, 8)), cache.frame(team));
  base.position.y = 0.22; tag(base, id, pickable);
  const cabin = new THREE.Mesh(cache.geometry('outpost-cabin', () => new THREE.CylinderGeometry(1.1, 1.35, 1.6, 8)), cache.hull(team));
  cabin.position.y = 1.15; tag(cabin, id, pickable);
  const visor = new THREE.Mesh(cache.geometry('outpost-visor', () => new THREE.BoxGeometry(1.15, 0.3, 0.12)), cache.glow(team, 1.5));
  visor.position.set(0, 1.42, -1.04);
  const mast = new THREE.Mesh(cache.geometry('outpost-mast', () => new THREE.CylinderGeometry(0.1, 0.14, 1.25, 6)), cache.frame(team));
  mast.position.y = 2.55; tag(mast, id, pickable);
  const eye = new THREE.Mesh(cache.geometry('outpost-eye', () => new THREE.SphereGeometry(0.3, 8, 6)), cache.glow(team, 2));
  eye.position.y = 3.15; tag(eye, id, pickable); spinners.push(eye);
  group.add(base, cabin, visor, mast, eye);
  return { group, spinners, column: eye, arm: null, pickable, generationParts: [] };
}

/** Zap Turret: oversized swivelling head and twin antenna ears for a playful silhouette. */
function buildTurret(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = []; const spinners: THREE.Object3D[] = [];
  const foot = new THREE.Mesh(cache.geometry('turret-foot', () => new THREE.CylinderGeometry(1, 1.2, 0.55, 8)), cache.frame(team));
  foot.position.y = 0.28; tag(foot, id, pickable);
  const neck = new THREE.Mesh(cache.geometry('turret-neck', () => new THREE.CylinderGeometry(0.34, 0.5, 1.25, 7)), cache.plate(team));
  neck.position.y = 1.12; tag(neck, id, pickable);
  const head = new THREE.Group(); head.position.y = 2;
  const dome = new THREE.Mesh(cache.geometry('turret-dome', () => new THREE.SphereGeometry(0.72, 8, 6)), cache.hull(team)); tag(dome, id, pickable);
  const eye = new THREE.Mesh(cache.geometry('turret-eye', () => new THREE.BoxGeometry(0.7, 0.2, 0.12)), cache.glow(team, 2.3)); eye.position.z = -0.66;
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(cache.geometry('turret-ear', () => new THREE.ConeGeometry(0.16, 0.65, 5)), cache.plate(team));
    ear.position.set(side * 0.48, 0.62, 0); ear.rotation.z = side * -0.28; head.add(ear);
  }
  const barrel = new THREE.Mesh(cache.geometry('turret-gun', () => new THREE.CylinderGeometry(0.12, 0.16, 1.3, 6)), cache.frame(team));
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0, -1.05); tag(barrel, id, pickable);
  head.add(dome, eye, barrel); spinners.push(head); group.add(foot, neck, head);
  return { group, spinners, column: eye, arm: head, pickable, generationParts: [] };
}

/** Heavy Foundry: broad furnace hall with smokeless energy stacks and a stamping hammer. */
function buildFoundry(cache: ResourceCache, team: Team, id: string): BuildingModel {
  const group = new THREE.Group(); const pickable: THREE.Object3D[] = [];
  const floor = new THREE.Mesh(cache.geometry('foundry-floor', () => new THREE.BoxGeometry(4.8, 0.4, 3.8)), cache.frame(team));
  floor.position.y = 0.2; tag(floor, id, pickable);
  const hall = new THREE.Mesh(cache.geometry('foundry-hall', () => new THREE.BoxGeometry(3.9, 2.2, 3.1)), cache.hull(team));
  hall.position.y = 1.45; tag(hall, id, pickable);
  const mouth = new THREE.Mesh(cache.geometry('foundry-mouth', () => new THREE.BoxGeometry(2.2, 1.35, 0.16)), cache.glow(team, 1.45));
  mouth.position.set(0, 1.15, -1.62);
  for (const side of [-1, 1]) {
    const stack = new THREE.Mesh(cache.geometry('foundry-stack', () => new THREE.CylinderGeometry(0.32, 0.48, 2.5, 7)), cache.plate(team));
    stack.position.set(side * 1.45, 3.05, 0.65); tag(stack, id, pickable); group.add(stack);
  }
  const hammer = new THREE.Group(); hammer.position.set(0, 3, 0);
  const beam = new THREE.Mesh(cache.geometry('foundry-beam', () => new THREE.BoxGeometry(3.8, 0.3, 0.35)), cache.frame(team));
  const block = new THREE.Mesh(cache.geometry('foundry-hammer', () => new THREE.BoxGeometry(0.8, 1.25, 0.8)), cache.plate(team)); block.position.y = -0.65;
  hammer.add(beam, block); group.add(floor, hall, mouth, hammer);
  return { group, spinners: [], column: mouth, arm: hammer, pickable, generationParts: [] };
}

export function buildBuildingModel(cache: ResourceCache, kind: BuildingTypeId, team: Team, id: string): BuildingModel {
  if (kind === 'core') return buildCore(cache, team, id);
  const model = kind === 'relay' ? buildRelay(cache, team, id)
    : kind === 'fabricator' ? buildFabricator(cache, team, id)
      : kind === 'wall' ? buildWall(cache, team, id)
        : kind === 'outpost' ? buildOutpost(cache, team, id)
          : kind === 'turret' ? buildTurret(cache, team, id)
            : buildFoundry(cache, team, id);
  const height = kind === 'wall' ? 1.65 : kind === 'foundry' ? 4.35 : kind === 'outpost' ? 3.6 : 3.2;
  const autonomyPanel = new THREE.Group(); autonomyPanel.position.set(BUILDINGS[kind].footprint[0] * 0.32, height, 0); autonomyPanel.visible = false;
  const stem = new THREE.Mesh(cache.geometry('generation-stem', () => new THREE.CylinderGeometry(0.05, 0.07, 0.55, 5)), cache.frame(team)); stem.position.y = 0.22;
  const panel = new THREE.Mesh(cache.geometry('generation-panel', () => new THREE.BoxGeometry(0.7, 0.08, 0.42)), cache.glow(team, 1)); panel.position.y = 0.52; panel.rotation.z = 0.15;
  autonomyPanel.add(stem, panel);
  const singularityOrb = new THREE.Mesh(cache.geometry('generation-orb', () => new THREE.OctahedronGeometry(0.24, 0)), cache.glow(team, 2.4));
  singularityOrb.position.set(-BUILDINGS[kind].footprint[0] * 0.3, height + 0.45, 0); singularityOrb.visible = false;
  model.group.add(autonomyPanel, singularityOrb);
  return { ...model, generationParts: [...model.generationParts, { part: autonomyPanel, min: 2 }, { part: singularityOrb, min: 3 }] };
}

/** Scaffolding shown while a site is still being assembled. */
export function buildConstructionScaffold(cache: ResourceCache, kind: BuildingTypeId, team: Team): THREE.Group {
  const group = new THREE.Group();
  const config = BUILDINGS[kind];
  const [width, depth] = config.footprint;
  const post = cache.geometry('scaffold-post', () => new THREE.BoxGeometry(0.16, 1, 0.16));
  const frame = cache.frame(team);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const pillar = new THREE.Mesh(post, frame);
    pillar.position.set((dx * width) / 2 - dx * 0.2, 0.5, (dz * depth) / 2 - dz * 0.2);
    group.add(pillar);
  }
  const beam = new THREE.Mesh(cache.geometry('scaffold-beam', () => new THREE.BoxGeometry(width, 0.12, 0.12)), frame);
  beam.position.y = 1;
  group.add(beam);
  return group;
}
