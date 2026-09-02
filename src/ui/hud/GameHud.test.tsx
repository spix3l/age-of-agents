import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CoreActions } from '../actions/CoreActions';
import { useUiStore } from '../store';
import { GameHud } from './GameHud';

describe('economy HUD', () => {
  it('renders resource balances, capacity, selection activity, and Core queue action', () => {
    useUiStore.getState().setEconomySnapshot({
      matter: 70, energy: 28, capacityUsed: 3, capacityReserved: 1, capacityMax: 8, totalUnits: 3, selectedCount: 1,
      selection: { type: 'building', name: 'Core', hp: 1500, maxHp: 1500, activity: 'Fabricating', detail: '1 queued', isPlayerCore: true },
      queue: { count: 1, progress: 0.5, label: '1 IN QUEUE' },
    });
    expect(useUiStore.getState().matter).toBe(70);
    expect(useUiStore.getState().capacityReserved).toBe(1);
    expect(useUiStore.getState().queue.progress).toBe(0.5);
    const html = renderToStaticMarkup(<GameHud />);
    const actions = renderToStaticMarkup(<CoreActions />);
    expect(html).toContain('MATTER');
    expect(html).toContain('AGENTS');
    expect(actions).toContain('FABRICATE WORKER');
    expect(actions).toContain('45 MATTER');
  });
});
