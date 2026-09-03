import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { entityId } from '../../game/types/ids';
import { useUiStore } from '../store';
import { ProductionActions } from './ProductionActions';
import { WorkerActions } from './WorkerActions';

describe('colony action surfaces', () => {
  it('renders construction, automation, Striker production, and empty queue states', () => {
    const workers = renderToStaticMarkup(<WorkerActions />);
    const production = renderToStaticMarkup(<ProductionActions unitTypes={['striker']} />);
    expect(workers).toContain('RELAY NODE');
    expect(workers).toContain('FABRICATOR');
    expect(workers).toContain('AUTO · MATTER');
    expect(workers).toContain('AUTO · ENERGY');
    expect(production).toContain('FABRICATE STRIKER');
    expect(production).toContain('QUEUE EMPTY');
  });

  it('routes queue cancellation through the UI command callback', () => {
    const callback = vi.fn();
    const id = entityId('ui-queue-order');
    useUiStore.getState().setCancelProductionRequest(callback);
    useUiStore.getState().cancelProduction(id);
    expect(callback).toHaveBeenCalledWith(id);
  });
});
