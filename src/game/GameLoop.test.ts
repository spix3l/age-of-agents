import { describe, expect, it, vi } from 'vitest';
import { GameLoop } from './GameLoop';

describe('GameLoop', () => {
  it('runs deterministic fixed steps and caps catch-up', () => {
    const update = vi.fn();
    const render = vi.fn();
    const loop = new GameLoop(update, render, { fixedStep: 0.1, maxCatchUpSteps: 3 });
    loop.advance(0.25);
    expect(update).toHaveBeenCalledTimes(2);
    loop.advance(10);
    expect(update).toHaveBeenCalledTimes(5);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('does not update while paused', () => {
    const update = vi.fn();
    const loop = new GameLoop(update, vi.fn());
    loop.setPaused(true);
    loop.advance(1);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not schedule duplicate frames and cancels on disposal', () => {
    const requestFrame = vi.fn(() => 42);
    const cancelFrame = vi.fn();
    const loop = new GameLoop(vi.fn(), vi.fn(), { requestFrame, cancelFrame });
    loop.start();
    loop.start();
    expect(requestFrame).toHaveBeenCalledTimes(1);
    loop.dispose();
    expect(cancelFrame).toHaveBeenCalledWith(42);
  });
});
