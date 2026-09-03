import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useUiStore } from '../store';
import { EndScreenCard } from './EndScreen';

describe('end screen', () => {
  it('stays hidden until a result is reported, then shows the outcome and statistics', () => {
    useUiStore.getState().restartMatch();
    const store = useUiStore.getState();
    expect(renderToStaticMarkup(<EndScreenCard result={store.matchResult} summary={store.matchSummary} onRestart={store.restartMatch} onMainMenu={store.returnToMenu} />)).toBe('');

    useUiStore.getState().setMatchOutcome('victory', {
      durationSeconds: 185, matterCollected: 640, energyCollected: 210, dataCollected: 80, agentsCreated: 14,
      agentsKilled: 9, agentsLost: 4, buildingsDestroyed: 2, buildingsLost: 1, buildingsConstructed: 6, finalGeneration: 3,
    });
    const victorious = useUiStore.getState();
    expect(victorious.matchResult).toBe('victory');
    const html = renderToStaticMarkup(<EndScreenCard result={victorious.matchResult} summary={victorious.matchSummary} onRestart={victorious.restartMatch} onMainMenu={victorious.returnToMenu} />);
    expect(html).toContain('VICTORY');
    expect(html).toContain('03:05');
    expect(html).toContain('PLAY AGAIN');
    expect(html).toContain('640');
  });

  it('renders Defeat and clears the result when a new match is requested', () => {
    useUiStore.getState().setMatchOutcome('defeat', useUiStore.getState().matchSummary);
    const defeated = useUiStore.getState();
    expect(renderToStaticMarkup(<EndScreenCard result={defeated.matchResult} summary={defeated.matchSummary} onRestart={defeated.restartMatch} onMainMenu={defeated.returnToMenu} />)).toContain('DEFEAT');

    const nonce = defeated.matchNonce;
    useUiStore.getState().restartMatch();
    const restarted = useUiStore.getState();
    expect(restarted.matchResult).toBeNull();
    expect(restarted.matchNonce).toBe(nonce + 1);
    expect(renderToStaticMarkup(<EndScreenCard result={restarted.matchResult} summary={restarted.matchSummary} onRestart={restarted.restartMatch} onMainMenu={restarted.returnToMenu} />)).toBe('');
  });
});
