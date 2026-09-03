import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ModelViewer, DEFAULT_OPTIONS, type ViewerOptions } from './ModelViewer';
import { SECTIONS_IN_ORDER, findModel, MODELS, type ModelEntry } from './registry';

const SOURCE_LABEL: Record<ModelEntry['source'], string> = {
  generated: 'img2threejs',
  'in-game': 'in-game model',
  none: 'reference only',
};

/** URL params let the review loop pin an exact view: ?model=core&az=90&el=20&zoom=1&ui=0. */
function readParams(): { id: string | null; options: ViewerOptions; chrome: boolean } {
  const params = new URLSearchParams(window.location.search);
  const num = (key: string, fallback: number) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && params.has(key) ? value : fallback;
  };
  return {
    id: params.get('model'),
    chrome: params.get('ui') !== '0',
    options: {
      azimuth: num('az', DEFAULT_OPTIONS.azimuth),
      elevation: num('el', DEFAULT_OPTIONS.elevation),
      zoom: num('zoom', DEFAULT_OPTIONS.zoom),
      spin: params.get('spin') === '1',
      grid: params.get('grid') !== '0',
      background: params.get('bg') ?? DEFAULT_OPTIONS.background,
      stripMaps: params.get('maps') === '0',
      ortho: params.get('cam') === 'ortho',
    },
  };
}

export function ModelLab() {
  const initial = useMemo(() => readParams(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<ModelViewer | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  const [selected, setSelected] = useState<ModelEntry>(() => findModel(initial.id));
  const [options, setOptions] = useState<ViewerOptions>(initial.options);
  const [query, setQuery] = useState('');
  const [showReference, setShowReference] = useState(true);
  const chrome = initial.chrome;

  useEffect(() => {
    if (!canvasRef.current) return;
    const viewer = new ModelViewer(canvasRef.current);
    viewerRef.current = viewer;
    // Headless probes (scripts/tmp-probe-model.mjs) reach the scene graph through this hook.
    (window as unknown as { __viewer?: ModelViewer }).__viewer = viewer;
    return () => {
      viewerRef.current = null;
      viewer.dispose();
    };
  }, []);

  useEffect(() => viewerRef.current?.setOptions(options), [options]);

  useEffect(() => {
    // `bg=none` has to reach the page, not just the WebGL clear colour: Playwright's
    // omitBackground only produces alpha when nothing behind the canvas is painted, and the
    // review gates fall back to "whole frame is foreground" the moment alpha is opaque.
    document.body.style.background = options.background === 'none' ? 'transparent' : '';
  }, [options.background]);

  useEffect(() => {
    viewerRef.current?.show(selected);
    document.title = `Model Lab — ${selected.label}`;
    const url = new URL(window.location.href);
    url.searchParams.set('model', selected.id);
    window.history.replaceState(null, '', url);
    // Headless capture waits on this instead of a fixed sleep.
    document.body.dataset.modelReady = selected.id;
  }, [selected, options.stripMaps]);

  const patch = useCallback((next: Partial<ViewerOptions>) => {
    setOptions((current) => ({ ...current, ...next }));
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    patch({
      azimuth: options.azimuth - (event.clientX - drag.x) * 0.4,
      elevation: Math.max(-85, Math.min(85, options.elevation + (event.clientY - drag.y) * 0.3)),
    });
    dragRef.current = { x: event.clientX, y: event.clientY };
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SECTIONS_IN_ORDER;
    return SECTIONS_IN_ORDER
      .map((group) => ({
        section: group.section,
        models: group.models.filter((m) => m.id.includes(needle) || m.label.toLowerCase().includes(needle)),
      }))
      .filter((group) => group.models.length > 0);
  }, [query]);

  const step = (delta: number) => {
    const index = MODELS.indexOf(selected);
    setSelected(MODELS[(index + delta + MODELS.length) % MODELS.length]!);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowDown' || event.key === 'j') step(1);
      if (event.key === 'ArrowUp' || event.key === 'k') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const download = () => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const link = document.createElement('a');
    link.href = viewer.snapshot();
    link.download = `${selected.id}-az${Math.round(options.azimuth)}.png`;
    link.click();
  };

  return (
    <div className={`lab${chrome ? '' : ' lab--bare'}`}>
      {chrome && (
        <aside className="lab-sidebar">
          <header className="lab-brand">
            <h1>Model Lab</h1>
            <p>{MODELS.length} models sliced from the asset sheet</p>
          </header>
          <input
            className="lab-search"
            type="search"
            placeholder="Filter models…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <nav className="lab-list">
            {sections.map((group) => (
              <section key={group.section}>
                <h2>{group.section}</h2>
                {group.models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`lab-item${model.id === selected.id ? ' is-active' : ''}`}
                    onClick={() => setSelected(model)}
                  >
                    <img src={model.referenceUrl} alt="" loading="lazy" />
                    <span className="lab-item-name">{model.label}</span>
                    <span className={`lab-tag lab-tag--${model.source}`}>{SOURCE_LABEL[model.source]}</span>
                  </button>
                ))}
              </section>
            ))}
          </nav>
        </aside>
      )}

      <main className="lab-stage">
        {chrome && (
          <div className="lab-toolbar">
            <div className="lab-title">
              <h2>{selected.label}</h2>
              <code>{selected.id}</code>
            </div>
            <label>
              Azimuth
              <input type="range" min={-180} max={180} value={options.azimuth}
                onChange={(e) => patch({ azimuth: Number(e.target.value) })} />
            </label>
            <label>
              Elevation
              <input type="range" min={-85} max={85} value={options.elevation}
                onChange={(e) => patch({ elevation: Number(e.target.value) })} />
            </label>
            <label>
              Zoom
              <input type="range" min={0.4} max={3} step={0.05} value={options.zoom}
                onChange={(e) => patch({ zoom: Number(e.target.value) })} />
            </label>
            <label className="lab-check">
              <input type="checkbox" checked={options.spin}
                onChange={(e) => patch({ spin: e.target.checked })} /> Turntable
            </label>
            <label className="lab-check">
              <input type="checkbox" checked={options.stripMaps}
                onChange={(e) => patch({ stripMaps: e.target.checked })} /> Strip maps
            </label>
            <label className="lab-check">
              <input type="checkbox" checked={options.grid}
                onChange={(e) => patch({ grid: e.target.checked })} /> Grid
            </label>
            <label className="lab-check">
              <input type="checkbox" checked={showReference}
                onChange={(e) => setShowReference(e.target.checked)} /> Reference
            </label>
            <button type="button" onClick={download}>Snapshot</button>
          </div>
        )}

        <div className="lab-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="lab-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onWheel={(event) => patch({ zoom: Math.max(0.4, Math.min(3, options.zoom - event.deltaY * 0.001)) })}
          />
          {!selected.build && (
            <p className="lab-empty">
              No 3D model yet — <strong>{selected.label}</strong> exists only as a reference crop.
            </p>
          )}
          {chrome && showReference && (
            <figure className="lab-reference">
              <img src={selected.referenceUrl} alt={`${selected.label} reference`} />
              <figcaption>reference</figcaption>
            </figure>
          )}
        </div>
      </main>
    </div>
  );
}
