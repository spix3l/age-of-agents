import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '../store';
import { PauseMenu } from './PauseMenu';

/**
 * Pause is store state, so that is where it is tested. (Static rendering reads zustand's initial
 * snapshot rather than the live one, which is why the render assertion here is only that an
 * unpaused match draws no overlay at all.)
 */
describe('pausing a match', () => {
  beforeEach(() => {
    useUiStore.setState({ menuOpen: false, matchResult: null, paused: false, saveNote: null, mode: 'campaign' });
  });

  it('draws nothing while the match is running', () => {
    expect(renderToStaticMarkup(<PauseMenu />)).toBe('');
  });

  it('holds and releases the match', () => {
    useUiStore.getState().togglePause();
    expect(useUiStore.getState().paused).toBe(true);
    useUiStore.getState().togglePause();
    expect(useUiStore.getState().paused).toBe(false);
    useUiStore.getState().setPaused(true);
    expect(useUiStore.getState().paused).toBe(true);
  });

  it('refuses to pause outside a live match', () => {
    useUiStore.setState({ menuOpen: true });
    useUiStore.getState().togglePause();
    expect(useUiStore.getState().paused).toBe(false);

    useUiStore.setState({ menuOpen: false, matchResult: 'victory' });
    useUiStore.getState().togglePause();
    expect(useUiStore.getState().paused).toBe(false);
  });

  it('reports what came of a save attempt', () => {
    useUiStore.setState({ paused: true, saveRequest: () => false });
    useUiStore.getState().saveGame();
    expect(useUiStore.getState().saveNote).toContain('SAVE FAILED');

    useUiStore.setState({ saveRequest: () => true });
    useUiStore.getState().saveGame();
    expect(useUiStore.getState().saveNote).toBe('MATCH SAVED');
  });

  it('leaves no pause behind when a match starts, restarts, or is abandoned', () => {
    for (const act of [() => useUiStore.getState().startMatch('freestyle'), () => useUiStore.getState().restartMatch(), () => useUiStore.getState().returnToMenu()]) {
      useUiStore.setState({ paused: true });
      act();
      expect(useUiStore.getState().paused).toBe(false);
    }
    expect(useUiStore.getState().mode).toBe('freestyle');
  });
});
