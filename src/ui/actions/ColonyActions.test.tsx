import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BUILDINGS } from '../../data/buildings';
import { entityId } from '../../game/types/ids';
import { useUiStore } from '../store';
import { ProductionActions } from './ProductionActions';
import { WorkerActions } from './WorkerActions';
import { SynthesisActions } from './SynthesisActions';

describe('colony action surfaces', () => {
  it('renders construction, automation, Striker production, and empty queue states', () => {
    const workers = renderToStaticMarkup(<WorkerActions />);
    const production = renderToStaticMarkup(<ProductionActions unitTypes={['striker']} />);
    expect(workers).toContain('RELAY NODE');
    expect(workers).toContain('FABRICATOR');
    expect(workers).toContain('KEEP GATHERING');
    expect(workers).toContain('MATTER');
    expect(workers).toContain('ENERGY');
    expect(production).toContain('FABRICATE STRIKER');
    expect(production).toContain('QUEUE EMPTY');
  });

  it('dims a build the colony cannot pay for and names what it is short of', () => {
    // The store's opening balances are zero, so every costed structure is out of reach.
    const broke = renderToStaticMarkup(<WorkerActions />);
    expect(broke).toContain('class="build-button unaffordable"');
    expect(broke).toContain('disabled');
    expect(broke).toContain('Needs more matter');
    expect(broke).toContain(`<b class="short">${BUILDINGS.relay.cost.matter}◆</b>`);
  });

  it('shows a plant what it converts, and which way its switch throws', () => {
    const recipe = '4 ϟ → 8 ◆ / 2s';
    const running = renderToStaticMarkup(<SynthesisActions plant={{ recipe, status: 'running', progress: 0.5 }} />);
    expect(running).toContain('TAKE OFFLINE');
    expect(running).toContain('CONVERTING');
    expect(running).toContain(recipe);

    const starved = renderToStaticMarkup(<SynthesisActions plant={{ recipe, status: 'starved', progress: 1 }} />);
    expect(starved).toContain('WAITING ON INPUT');

    // Switched off: the switch offers the other direction and the cycle bar reads empty.
    const paused = renderToStaticMarkup(<SynthesisActions plant={{ recipe, status: 'paused', progress: 0.5 }} />);
    expect(paused).toContain('BRING ONLINE');
    expect(paused).toContain('width:0%');
  });

  it('routes a plant switch through the UI command callback', () => {
    const callback = vi.fn();
    useUiStore.getState().setSynthesisToggleRequest(callback);
    useUiStore.getState().toggleSynthesis();
    expect(callback).toHaveBeenCalled();
  });

  it('routes queue cancellation through the UI command callback', () => {
    const callback = vi.fn();
    const id = entityId('ui-queue-order');
    useUiStore.getState().setCancelProductionRequest(callback);
    useUiStore.getState().cancelProduction(id);
    expect(callback).toHaveBeenCalledWith(id);
  });
});
