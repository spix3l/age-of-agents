import type { BuildingEntity, UnitEntity, Vec2 } from '../types/simulation';

export type VisionState = 0 | 1 | 2;
export interface VisionSnapshot { readonly width: number; readonly height: number; readonly states: Uint8Array }

/** Low-frequency grid visibility. State 0 is unknown, 1 explored, 2 currently visible. */
export class VisionSystem {
  readonly width: number;
  readonly height: number;
  private readonly states: Uint8Array;
  private cooldown = 0;

  constructor(
    private readonly minX: number,
    private readonly minZ: number,
    maxX: number,
    maxZ: number,
    readonly cellSize = 4,
  ) {
    this.width = Math.ceil((maxX - minX) / cellSize);
    this.height = Math.ceil((maxZ - minZ) / cellSize);
    this.states = new Uint8Array(this.width * this.height);
  }

  update(owned: readonly (UnitEntity | BuildingEntity)[], delta: number): boolean {
    this.cooldown -= delta;
    if (this.cooldown > 0) return false;
    this.cooldown = 0.15;
    for (let index = 0; index < this.states.length; index += 1) if (this.states[index] === 2) this.states[index] = 1;
    for (const entity of owned) if (entity.alive) this.reveal(entity.position, 'movementSpeed' in entity ? entity.combat.vision : entity.vision);
    return true;
  }

  stateAt(position: Vec2): VisionState {
    const col = Math.floor((position.x - this.minX) / this.cellSize);
    const row = Math.floor((position.z - this.minZ) / this.cellSize);
    if (col < 0 || row < 0 || col >= this.width || row >= this.height) return 0;
    return (this.states[row * this.width + col] ?? 0) as VisionState;
  }

  snapshot(): VisionSnapshot { return { width: this.width, height: this.height, states: this.states.slice() }; }

  private reveal(position: Vec2, radius: number): void {
    const centerCol = Math.floor((position.x - this.minX) / this.cellSize);
    const centerRow = Math.floor((position.z - this.minZ) / this.cellSize);
    const cellRadius = Math.ceil(radius / this.cellSize);
    for (let row = centerRow - cellRadius; row <= centerRow + cellRadius; row += 1) {
      for (let col = centerCol - cellRadius; col <= centerCol + cellRadius; col += 1) {
        if (col < 0 || row < 0 || col >= this.width || row >= this.height) continue;
        const world = { x: this.minX + (col + 0.5) * this.cellSize, z: this.minZ + (row + 0.5) * this.cellSize };
        if (Math.hypot(world.x - position.x, world.z - position.z) <= radius + this.cellSize * 0.7) this.states[row * this.width + col] = 2;
      }
    }
  }
}
