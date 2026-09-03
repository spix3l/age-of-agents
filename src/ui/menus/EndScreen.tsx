import { useState } from 'react';
import { useUiStore, type MatchSummary } from '../store';
import type { MatchResult } from '../../game/match/MatchState';
import type { AIDifficulty } from '../../data/ai';
import { copyToClipboard, downloadMatchCard, formatDuration, formatMatchSummary } from './matchShare';

interface EndScreenCardProps {
  readonly result: MatchResult | null;
  readonly summary: MatchSummary;
  readonly difficulty: AIDifficulty;
  readonly seed: number;
  readonly onRestart: () => void;
  readonly onMainMenu: () => void;
}

/** Presentational half, kept separate from the store so it can be rendered in tests. */
export function EndScreenCard({ result, summary, difficulty, seed, onRestart, onMainMenu }: EndScreenCardProps) {
  const [shareNote, setShareNote] = useState<string | null>(null);
  if (!result) return null;
  const victory = result === 'victory';
  const match = { result, summary, difficulty, seed };
  return (
    <div className={`end-screen ${victory ? 'victory' : 'defeat'}`} role="dialog" aria-modal="true" aria-label={victory ? 'Victory' : 'Defeat'}>
      <div className="end-card">
        <small>{victory ? 'ENEMY CORE DESTROYED' : 'CORE LOST'}</small>
        <h1>{victory ? 'VICTORY' : 'DEFEAT'}</h1>
        <dl className="end-stats">
          <div><dt>DURATION</dt><dd>{formatDuration(summary.durationSeconds)}</dd></div>
          <div><dt>MATTER COLLECTED</dt><dd>{Math.floor(summary.matterCollected)}</dd></div>
          <div><dt>ENERGY COLLECTED</dt><dd>{Math.floor(summary.energyCollected)}</dd></div>
          <div><dt>DATA COLLECTED</dt><dd>{Math.floor(summary.dataCollected)}</dd></div>
          <div><dt>AGENTS CREATED</dt><dd>{summary.agentsCreated}</dd></div>
          <div><dt>AGENTS DESTROYED</dt><dd>{summary.agentsKilled}</dd></div>
          <div><dt>AGENTS LOST</dt><dd>{summary.agentsLost}</dd></div>
          <div><dt>BUILDINGS DESTROYED</dt><dd>{summary.buildingsDestroyed}</dd></div>
          <div><dt>BUILDINGS LOST</dt><dd>{summary.buildingsLost}</dd></div>
          <div><dt>BUILDINGS BUILT</dt><dd>{summary.buildingsConstructed}</dd></div>
          <div><dt>FINAL GENERATION</dt><dd>{summary.finalGeneration}</dd></div>
        </dl>
        <div className="end-share">
          <button
            type="button"
            onClick={async () => {
              // Both paths report their own failure: a refused clipboard or a blocked download
              // must say so rather than look like nothing happened.
              const copied = await copyToClipboard(formatMatchSummary(match));
              setShareNote(copied ? 'SUMMARY COPIED' : 'COPY BLOCKED BY BROWSER');
            }}
          >
            COPY SUMMARY
          </button>
          <button
            type="button"
            onClick={async () => {
              const saved = await downloadMatchCard(match);
              setShareNote(saved ? 'IMAGE SAVED' : 'DOWNLOAD BLOCKED BY BROWSER');
            }}
          >
            SAVE IMAGE
          </button>
          <span className="end-seed">SEED {seed}</span>
          {shareNote && <span className="end-share-note" role="status">{shareNote}</span>}
        </div>
        <div className="end-actions">
          <button type="button" className="primary" onClick={onRestart}>PLAY AGAIN</button>
          <button type="button" onClick={onMainMenu}>MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}

export function EndScreen() {
  const result = useUiStore((state) => state.matchResult);
  const summary = useUiStore((state) => state.matchSummary);
  const difficulty = useUiStore((state) => state.difficulty);
  const seed = useUiStore((state) => state.matchSeed);
  const restart = useUiStore((state) => state.restartMatch);
  const mainMenu = useUiStore((state) => state.returnToMenu);
  return (
    <EndScreenCard
      result={result}
      summary={summary}
      difficulty={difficulty}
      seed={seed}
      onRestart={restart}
      onMainMenu={mainMenu}
    />
  );
}
