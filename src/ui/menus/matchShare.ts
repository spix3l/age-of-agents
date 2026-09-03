import type { MatchResult } from '../../game/match/MatchState';
import type { AIDifficulty } from '../../data/ai';
import { GENERATIONS } from '../../data/technologies';
import type { MatchSummary } from '../store';

export interface ShareableMatch {
  readonly result: MatchResult;
  readonly summary: MatchSummary;
  readonly difficulty: AIDifficulty;
  /** Included so anyone the result is shared with can play the same map. */
  readonly seed: number;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The match as plain text, sized to paste into a chat window.
 *
 * Everything here comes from the finished match; nothing is fetched and nothing is sent. The seed
 * is the payload that matters — it is what turns a boast into a rematch.
 */
export function formatMatchSummary(match: ShareableMatch): string {
  const { summary, result, difficulty, seed } = match;
  const outcome = result === 'victory' ? 'VICTORY' : 'DEFEAT';
  const generation = GENERATIONS[summary.finalGeneration].label;
  return [
    `AGE OF AGENTS — ${outcome} in ${formatDuration(summary.durationSeconds)}`,
    `Opponent: ${difficulty.toUpperCase()}   Reached: Generation ${summary.finalGeneration} (${generation})`,
    `Gathered: ${Math.floor(summary.matterCollected)} matter · ${Math.floor(summary.energyCollected)} energy · ${Math.floor(summary.dataCollected)} data`,
    `Agents: ${summary.agentsCreated} built · ${summary.agentsKilled} destroyed · ${summary.agentsLost} lost`,
    `Structures: ${summary.buildingsConstructed} built · ${summary.buildingsDestroyed} destroyed · ${summary.buildingsLost} lost`,
    `Seed: ${seed} — play the same map`,
  ].join('\n');
}

/** Copies text to the clipboard, falling back to a hidden textarea where the API is unavailable. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the manual path */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

const CARD_WIDTH = 1000;
const CARD_HEIGHT = 560;

/**
 * Draws the result as a shareable card.
 *
 * Rendered on a canvas rather than assembled from an image asset, so it needs no network, no
 * fonts beyond the system stack, and works from a file:// build.
 */
export function drawMatchCard(match: ShareableMatch): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return canvas;

  const victory = match.result === 'victory';
  const accent = victory ? '#29d5f5' : '#f5a623';

  const backdrop = context.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
  backdrop.addColorStop(0, '#0d1620');
  backdrop.addColorStop(1, '#16242c');
  context.fillStyle = backdrop;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  context.strokeStyle = accent;
  context.lineWidth = 3;
  context.strokeRect(18, 18, CARD_WIDTH - 36, CARD_HEIGHT - 36);

  context.fillStyle = accent;
  context.font = '700 20px system-ui, sans-serif';
  context.fillText('AGE OF AGENTS', 56, 82);

  context.fillStyle = '#eef4f8';
  context.font = '800 92px system-ui, sans-serif';
  context.fillText(victory ? 'VICTORY' : 'DEFEAT', 54, 178);

  context.fillStyle = '#9fb2bf';
  context.font = '600 22px system-ui, sans-serif';
  context.fillText(
    `${formatDuration(match.summary.durationSeconds)}  ·  ${match.difficulty.toUpperCase()}  ·  GENERATION ${match.summary.finalGeneration}`,
    56, 222,
  );

  const rows: readonly (readonly [string, string])[] = [
    ['MATTER', String(Math.floor(match.summary.matterCollected))],
    ['ENERGY', String(Math.floor(match.summary.energyCollected))],
    ['DATA', String(Math.floor(match.summary.dataCollected))],
    ['AGENTS BUILT', String(match.summary.agentsCreated)],
    ['AGENTS DESTROYED', String(match.summary.agentsKilled)],
    ['AGENTS LOST', String(match.summary.agentsLost)],
    ['STRUCTURES BUILT', String(match.summary.buildingsConstructed)],
    ['STRUCTURES RAZED', String(match.summary.buildingsDestroyed)],
  ];
  rows.forEach(([label, value], index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 56 + column * 228;
    const y = 300 + row * 96;
    context.fillStyle = '#7f95a3';
    context.font = '700 14px system-ui, sans-serif';
    context.fillText(label, x, y);
    context.fillStyle = '#eef4f8';
    context.font = '800 40px system-ui, sans-serif';
    context.fillText(value, x, y + 44);
  });

  context.fillStyle = '#7f95a3';
  context.font = '600 17px system-ui, sans-serif';
  context.fillText(`SEED ${match.seed} — play the same map`, 56, CARD_HEIGHT - 44);
  return canvas;
}

/** Offers the card as a PNG download. Resolves false if the browser refuses to produce one. */
export async function downloadMatchCard(match: ShareableMatch): Promise<boolean> {
  try {
    const canvas = drawMatchCard(match);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `age-of-agents-${match.result}-${match.seed}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoked on the next tick so the click has already started the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}
