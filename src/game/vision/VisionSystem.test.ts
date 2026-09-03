import { describe, expect, it } from 'vitest';
import { createUnitEntity } from '../scenarios/economy';
import { VisionSystem } from './VisionSystem';

describe('fog of war vision', () => {
  it('moves cells from unknown to visible to explored and reveals them again', () => {
    const vision = new VisionSystem(0, 0, 40, 40, 4);
    const scout = createUnitEntity('vision-scout', 'scout', 'player', { x: 8, z: 8 });
    expect(vision.stateAt({ x: 8, z: 8 })).toBe(0);
    expect(vision.update([scout], 1)).toBe(true);
    expect(vision.stateAt({ x: 8, z: 8 })).toBe(2);
    scout.position = { x: 34, z: 34 };
    expect(vision.update([scout], 1)).toBe(true);
    expect(vision.stateAt({ x: 8, z: 8 })).toBe(1);
    scout.position = { x: 8, z: 8 };
    vision.update([scout], 1);
    expect(vision.stateAt({ x: 8, z: 8 })).toBe(2);
  });

  it('gives the Scout materially more map coverage than a Worker', () => {
    const workerVision = new VisionSystem(0, 0, 48, 48, 4);
    const scoutVision = new VisionSystem(0, 0, 48, 48, 4);
    workerVision.update([createUnitEntity('worker-vision', 'worker', 'player', { x: 24, z: 24 })], 1);
    scoutVision.update([createUnitEntity('scout-vision', 'scout', 'player', { x: 24, z: 24 })], 1);
    const visible = (vision: VisionSystem) => [...vision.snapshot().states].filter((state) => state === 2).length;
    expect(visible(scoutVision)).toBeGreaterThan(visible(workerVision) * 2);
  });

  it('keeps the 60-Agent vision pass bounded and throttled', () => {
    const vision = new VisionSystem(-60, -44, 60, 44, 4);
    const agents = Array.from({ length: 60 }, (_, index) => createUnitEntity(
      `perf-agent-${index}`,
      index % 6 === 0 ? 'scout' : 'worker',
      'player',
      { x: -50 + (index % 10) * 10, z: -36 + Math.floor(index / 10) * 12 },
    ));
    expect(vision.update(agents, 1 / 30)).toBe(true);
    expect(vision.update(agents, 1 / 30)).toBe(false);

    const started = performance.now();
    for (let index = 0; index < 100; index += 1) vision.update(agents, 1);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
