# Image analysis — Core (art/models/core.png, 156 x 199)

Observation is separated from inference; every inference is marked (inf).

## Layer 1 — Identification & classification
Work type: **stepped radial fortress keep with an axial beam emitter** (game RTS main base).
Broad classification: architectural machine / static structure. `primaryDomain: object`.
Confidence 0.92. Physical inventory before purpose: three stacked tiers of armour, a ring of
radial buttress pods, an axial aperture at the apex, a vertical light column above it.

## Layer 2 — Overall form & silhouette
Bounding volume: a truncated hexagonal frustum (wider at the base) — footprint is a regular
**hexagon**, symmetry is **radial, order 6** (inf: only ~4 faces are visible; the 6-fold read
comes from the base plinth's visible corner angles). Shape language: geometric, hard-surface,
chamfered. Proportion: overall height ≈ 0.75 x base width, excluding the beam. The beam roughly
doubles the image height and has no volume of its own.

## Layer 3 — Macro → meso → micro
- **macro-01 base plinth** — a low hexagonal slab with a chamfered top edge and a recessed skirt.
  - meso: 6 corner buttress feet (rounded-cuboid, silver cap); a front entry ramp; a fascia band
    of amber light bars, one per face.
- **macro-02 lower armour ring** — 6 large rounded-cuboid pods seated on the plinth, angled
  outward, each with a silver cap plate.
  - meso: per pod — a body cuboid, a top cap plate, a lateral cyan light slot, an amber bar.
- **macro-03 mid tier drum** — a hexagonal drum, inset relative to the lower ring.
  - meso: 6 radial fin/vent modules; a front central pylon column carrying a stack of amber bars
    and a square status panel.
- **macro-04 crown collar** — a ring of ~8 trapezoidal armour plates leaning inward, forming the
  dome shoulder (inf: count is 8 from the visible arc; occluded on the far side).
  - meso: per plate — a wedge body, a cyan inlay strip, a silver bevel.
- **macro-05 emitter basin** — a concave hexagonal dish inset in the crown, dark, holding a
  glowing torus ring around a central aperture.
- **macro-06 beam** — an axial column of cyan light rising from the aperture; no solid surface.
- micro feature groups (shared): amber horizontal light bars; cyan vertical light slots; 3-dot
  square status panels; bolt clusters at plate corners; rubble scattered on the plinth front.

## Layer 4 — Spatial relationships
`<lower armour ring, attached-to, base plinth>` — butt contact on the plinth top face.
`<mid tier drum, above, lower armour ring>` — overlap; the drum's skirt sinks into the ring.
`<crown collar, attached-to, mid tier drum>` — socket; the collar's plates seat in a rebate.
`<emitter basin, embedded-in, crown collar>` — embed, recessed below the collar rim.
`<glow ring, inside, emitter basin>` — flush with the basin floor.
`<beam, emitted-from, aperture>` — coaxial with the structure's vertical axis.
`<buttress feet, below, lower armour ring>` — each foot is radially aligned with one pod.

## Layer 5 — Materials & surface (PBR)
- **steel-dark** (bodies, drum, plinth): albedo very dark desaturated blue, metalness ~0.85,
  roughness ~0.55; observable: broad soft speculars with no mirror reflection (inf: brushed
  or lightly coated steel).
- **trim-silver** (cap plates, bevels): albedo light neutral grey, metalness ~0.9,
  roughness ~0.3; observable: a tight bright highlight along each cap's top edge.
- **glass-dark** (recessed panels, basin floor): albedo near black, metalness 0, roughness ~0.15;
  observable: a single sharp highlight, no diffuse body.
- **emissive-cyan** (slots, inlays, ring, beam): self-lit, no shading gradient across the strip.
- **emissive-amber** (bars): self-lit, warmer and lower value than the cyan.
- Relief: panel seams and bolt heads only; no pitting, grain, or wear anywhere (the asset is
  factory-clean).

## Layer 6 — Color & finish
Values sampled from the crop: dark steel `#2b333c`, silver trim `#9aa4ac`, cyan emissive
`#3fd8f5`, amber emissive `#f5a12b`, panel black `#10161b`. Finish: satin on the steel, gloss on
the trim, gloss on the glass. The beam is a vertical gradient, stops: `#bff4ff` at 0.0 (base),
`#3fd8f5` at 0.35, `#1a9ec4` at 1.0, alpha falling to 0 at the top.

## Layer 7 — Identity-defining features
1. The **axial cyan beam** — the single strongest silhouette identifier.
2. The **radial pod ring** with silver cap plates — the "shoulders" of the keep.
3. The **amber-bar fascia** running one bar per plinth face (only warm hue on the model).
4. The **recessed dark basin with a glowing torus ring** at the apex.
5. The **stepped three-tier profile** — no tier shares a radius with another.

## Layer 8 — Uncertainty & single-image limits
- **hidden**: the entire rear hemisphere, the plinth underside, the basin interior below the ring.
- **uncertain**: the exact count of crown collar plates (read as 8) and of radial pods (read as 6);
  whether the front ramp is a door or a ramp.
- **occluded**: the mid-tier drum behind the front pylon.
- **needs another view**: to confirm 6-fold vs 8-fold symmetry of the lower ring.
Each of these is carried into `unknownsToResolveBeforeImplementation`; the reconstruction commits
to 6-fold radial symmetry and states it as a stylization, not a measurement.
