import { describe, expect, it } from 'vitest';
import { entityId } from '../../types/ids';
import { createResourceNode, extractResource, isDepleted } from './ResourceNode';

describe('resource nodes', () => {
  it('caps extraction at the remaining finite amount and depletes', () => {
    const node = createResourceNode(entityId('matter-test'), 'matter', { x: 2, z: 3 }, 12);
    expect(extractResource(node, 10)).toBe(10);
    expect(extractResource(node, 10)).toBe(2);
    expect(node.remaining).toBe(0);
    expect(isDepleted(node)).toBe(true);
    expect(extractResource(node, 1)).toBe(0);
  });
});
