import { BUILDINGS } from '../../data/buildings';
import { SYNTHESIS } from '../../data/synthesis';
import { BUILDING_GENERATION } from '../../data/technologies';
import type { PlaceableBuildingType } from '../../game/building/PlacementController';
import type { ResourceType } from '../../game/types/simulation';
import { useUiStore } from '../store';
import { useState } from 'react';
import { ModelPortrait } from '../hud/ModelPortrait';

const ACTIONS: readonly { readonly type: PlaceableBuildingType; readonly glyph: string }[] = [
  { type: 'relay', glyph: '⌁' },
  { type: 'fabricator', glyph: '▦' },
  { type: 'habitat', glyph: '⌂' },
  { type: 'depot', glyph: '▤' },
  { type: 'wall', glyph: '▰' },
  { type: 'gate', glyph: '∏' },
  { type: 'outpost', glyph: '⌖' },
  { type: 'turret', glyph: '⏂' },
  { type: 'reclaimer', glyph: '♺' },
  { type: 'datalab', glyph: '⌬' },
  { type: 'foundry', glyph: '⬢' },
];

const GLYPH: Readonly<Record<ResourceType, string>> = { matter: '◆', energy: 'ϟ', data: '✦' };
const ORDER: readonly ResourceType[] = ['matter', 'energy', 'data'];

/**
 * The Worker's order panel: what it can build, and what it can be told to keep gathering.
 *
 * Cost is stated in the same glyphs as the resource bar, and anything the colony cannot pay for
 * right now is dimmed and unclickable with the resource it is short of called out. Arming a tool
 * you cannot afford and finding out only after clicking the ground was the single most confusing
 * thing in the HUD: the refusal named "insufficient resources" while the number the player was
 * watching looked perfectly healthy.
 */
export function WorkerActions({ enabled = true }: { readonly enabled?: boolean }) {
  const [tab, setTab] = useState('Build');
  const beginBuild = useUiStore((state) => state.beginBuild);
  const placementMode = useUiStore((state) => state.placementMode);
  const automate = useUiStore((state) => state.automate);
  const generation = useUiStore((state) => state.generation);
  const balances: Readonly<Record<ResourceType, number>> = {
    matter: useUiStore((state) => state.matter),
    energy: useUiStore((state) => state.energy),
    data: useUiStore((state) => state.data),
  };
  const unlocked = ACTIONS.filter(({ type }) => generation >= BUILDING_GENERATION[type])
    .filter(({ type }) => tab === 'Build' || (tab === 'Defense'
      ? ['wall', 'gate', 'outpost', 'turret'].includes(type)
      : !['wall', 'gate', 'outpost', 'turret'].includes(type)));

  return (
    <section className="worker-actions" aria-label="Worker orders">
      <div className="action-group">
        <div className="catalog-tabs" aria-label="Construction categories">
          {['Build', 'Structures', 'Defense'].map((name) => <button key={name} type="button" aria-pressed={tab === name} onClick={() => setTab(name)}>{name.toUpperCase()}</button>)}
        </div>
        <div className="build-grid">
          {unlocked.map(({ type }) => {
            const config = BUILDINGS[type];
            const cost = config.cost as Readonly<Partial<Record<ResourceType, number>>>;
            const entries = ORDER.filter((resource) => (cost[resource] ?? 0) > 0);
            const short = entries.filter((resource) => balances[resource] < (cost[resource] ?? 0));
            const active = placementMode === type;
            const plant = SYNTHESIS[type];
            return (
              <button
                key={type}
                type="button"
                className={`build-button${active ? ' active' : ''}${short.length > 0 ? ' unaffordable' : ''}`}
                onClick={() => beginBuild(type)}
                disabled={!enabled || short.length > 0}
                aria-pressed={active}
                title={!enabled ? 'Select a Worker to build' : short.length > 0 ? `Needs more ${short.join(' and ')}` : config.label}
              >
                <ModelPortrait kind={type} />
                <span className="build-copy">
                  <strong>{config.label.toUpperCase()}</strong>
                  <small>
                    {entries.map((resource) => (
                      <b key={resource} className={short.includes(resource) ? 'short' : undefined}>
                        {cost[resource]}{GLYPH[resource]}
                      </b>
                    ))}
                    {config.capacityUse > 0 && <b className="crew">{config.capacityUse}⬡</b>}
                  </small>
                  {plant && <small className="build-note">{plant.input.matter ? `${plant.input.matter}◆ ` : ''}{plant.input.energy ? `${plant.input.energy}ϟ ` : ''}→ {plant.amount}{GLYPH[plant.output]}</small>}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {enabled ? <div className="action-group">
        <span className="group-label">KEEP GATHERING</span>
        <div className="automation-row">
          <button type="button" className="automation-button matter" onClick={() => automate('matter')}>◆ MATTER</button>
          <button type="button" className="automation-button energy" onClick={() => automate('energy')}>ϟ ENERGY</button>
          <button type="button" className="automation-button data" onClick={() => automate('data')}>✦ DATA</button>
        </div>
        <small className="placement-hint">CLICK OR DRAG TO PLACE · R ROTATES · ESC / RMB CANCEL</small>
      </div> : <small className="placement-hint">SELECT A WORKER TO CONSTRUCT</small>}
    </section>
  );
}
