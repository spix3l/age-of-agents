import { useCallback, useEffect, useRef } from 'react';
import { MAP_BOUNDS, MAP_SIZE, WORLD_OBSTACLES } from '../../game/world/map';
import { useUiStore } from '../store';

const SIZE = 190;
/** Vision states, matching `VisionSystem`: 0 unknown, 1 explored, 2 visible. */
const UNKNOWN = 0;
const EXPLORED = 1;

const BLIP_COLOUR: Readonly<Record<string, string>> = {
  own: '#4fd8ff',
  hostile: '#ff6a3c',
  matter: '#f0b83c',
  energy: '#5fe3d0',
  data: '#c3a4ff',
};

/**
 * The whole battlefield at a glance, and a way to move around it.
 *
 * It draws from the same throttled 10 Hz snapshot the rest of the HUD uses — never per frame —
 * and its hostile blips come from the store already filtered through the world's vision
 * predicate, so the minimap can never reveal something the battlefield is hiding.
 */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimap = useUiStore((state) => state.minimap);
  const jumpTo = useUiStore((state) => state.jumpTo);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    if (canvas.width !== SIZE * ratio) {
      canvas.width = SIZE * ratio;
      canvas.height = SIZE * ratio;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, SIZE, SIZE);

    const toCanvasX = (worldX: number): number => ((worldX - MAP_BOUNDS.minX) / MAP_SIZE.width) * SIZE;
    const toCanvasY = (worldZ: number): number => ((worldZ - MAP_BOUNDS.minZ) / MAP_SIZE.depth) * SIZE;

    context.fillStyle = '#0d1a1f';
    context.fillRect(0, 0, SIZE, SIZE);
    // Terrain is public geography; unit intelligence below still uses the vision snapshot.
    for (let row = 0; row < SIZE; row += 3) {
      for (let col = 0; col < SIZE; col += 3) {
        const shade = Math.sin(col * 0.13 + Math.cos(row * 0.08)) * Math.cos(row * 0.11);
        context.fillStyle = shade > 0.2 ? '#1c2a24' : shade < -0.3 ? '#142321' : '#182723';
        context.fillRect(col, row, 3, 3);
      }
    }
    for (const obstacle of WORLD_OBSTACLES) {
      context.fillStyle = '#34403a';
      context.beginPath();
      context.ellipse(toCanvasX(obstacle.center.x), toCanvasY(obstacle.center.z), obstacle.size.x / MAP_SIZE.width * SIZE / 2, obstacle.size.z / MAP_SIZE.depth * SIZE / 2, obstacle.rotation ?? 0, 0, Math.PI * 2);
      context.fill();
    }

    // Fog first, as the ground itself: unknown stays near-black, explored is dim, visible is lit.
    const { fog, fogWidth, fogHeight } = minimap;
    if (fogWidth > 0 && fogHeight > 0 && fog.length >= fogWidth * fogHeight) {
      const cellWidth = SIZE / fogWidth;
      const cellHeight = SIZE / fogHeight;
      for (let row = 0; row < fogHeight; row += 1) {
        for (let col = 0; col < fogWidth; col += 1) {
          const state = fog[row * fogWidth + col] ?? UNKNOWN;
          if (state === UNKNOWN) continue;
          context.fillStyle = state === EXPLORED ? '#22333a' : '#3c5f4a';
          context.fillRect(col * cellWidth, row * cellHeight, cellWidth + 0.6, cellHeight + 0.6);
        }
      }
    }

    for (const blip of minimap.blips) {
      context.fillStyle = BLIP_COLOUR[blip.kind] ?? '#8b9299';
      const size = blip.building ? 4 : 2.4;
      context.fillRect(toCanvasX(blip.x) - size / 2, toCanvasY(blip.z) - size / 2, size, size);
    }

    // The camera's footprint, so the minimap says where you are as well as what is out there.
    const halfX = (minimap.viewHalf / MAP_SIZE.width) * SIZE;
    const halfY = (minimap.viewHalf / MAP_SIZE.depth) * SIZE;
    context.strokeStyle = 'rgba(224, 244, 255, 0.85)';
    context.lineWidth = 1.5;
    context.strokeRect(
      toCanvasX(minimap.focusX) - halfX,
      toCanvasY(minimap.focusZ) - halfY * 0.72,
      halfX * 2,
      halfY * 1.44,
    );
  }, [minimap]);

  const jumpFromEvent = useCallback((event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;
    jumpTo(MAP_BOUNDS.minX + fx * MAP_SIZE.width, MAP_BOUNDS.minZ + fy * MAP_SIZE.depth);
  }, [jumpTo]);

  return (
    <section className="minimap" aria-label="Battlefield minimap">
      <canvas
        ref={canvasRef}
        className="minimap-canvas"
        style={{ width: SIZE, height: SIZE }}
        onPointerDown={(event) => {
          // Capture so a drag keeps scrubbing the camera even outside the canvas.
          event.currentTarget.setPointerCapture(event.pointerId);
          jumpFromEvent(event);
        }}
        onPointerMove={(event) => { if (event.buttons === 1) jumpFromEvent(event); }}
        onContextMenu={(event) => event.preventDefault()}
      />
      <span className="minimap-compass">N</span>
    </section>
  );
}
