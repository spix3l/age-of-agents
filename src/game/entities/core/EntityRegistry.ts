import type { EntityId } from '../../types/ids';
import type { SimEntity } from '../../types/simulation';

export class EntityRegistry<T extends SimEntity = SimEntity> {
  private readonly entities = new Map<EntityId, T>();

  add(entity: T): void {
    if (this.entities.has(entity.id)) throw new Error(`Duplicate entity ID: ${entity.id}`);
    this.entities.set(entity.id, entity);
  }

  get(id: EntityId): T | undefined { return this.entities.get(id); }
  has(id: EntityId): boolean { return this.entities.has(id); }
  all(): readonly T[] { return [...this.entities.values()]; }
  alive(): readonly T[] { return this.all().filter((entity) => entity.alive); }

  destroy(id: EntityId): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;
    entity.alive = false;
    return this.entities.delete(id);
  }

  clear(): void { this.entities.clear(); }
  get size(): number { return this.entities.size; }
}
