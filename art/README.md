# Art pipeline: asset sheet → per-model crops → procedural Three.js

Three stages, each reproducible from the command line. Nothing here is hand-placed.

```
art/reference/asset-sheet.png          the source sheet (1536 x 1024)
        │  python3 art/extract_models.py
        ▼
art/models/*.png  +  art/models.json   68 per-model crops and their sheet boxes
        │  the img2threejs skill, one directory per model
        ▼
art/img2threejs/<model>/               spec, evidence, renders, review history
        │  scripts/generate-threejs-model.sh
        ▼
src/game/rendering/models/generated/   the procedural factory the Model Lab renders
```

## 1. Extraction — `art/extract_models.py`

The sheet is panels of models in labelled rows. Rather than hand-tuning 68 boxes, each row is
declared as a **band** (a rectangle containing only art, no label text) plus the ordered names of
the models in it. The band is split on the empty columns between models and each crop tightened to
the ink, so a slightly-wrong band still yields a correct crop. Re-run it any time:

```bash
python3 art/extract_models.py     # rewrites art/models/ and art/models.json
```

It exits non-zero and names the band if a row yields a different number of models than declared —
so a mis-declared band fails loudly instead of writing silent garbage.

## 2. Reconstruction — the img2threejs pipeline

One directory per model under `art/img2threejs/`, holding the whole audit trail: the layered image
analysis, the suitability verdict, the pre-spec assessment, the detail inventory with its zone
crops, per-material evidence crops and extracted PBR channels, every review render, and the
`reviewHistory` inside `object-sculpt-spec.json`.

The spec is **authored by a script**, `author_spec.py`, not hand-edited. A `refine-spec` iteration
re-runs that script, so the reconstruction decisions live in one readable file instead of a
4000-line JSON diff, and the script carries `reviewHistory` and the pass ledger forward rather than
overwriting them.

```bash
python3 art/img2threejs/core/author_spec.py                       # scaffold.json -> spec
scripts/generate-threejs-model.sh <spec> <out.ts> <pass-id>       # spec -> factory
node scripts/capture-model.mjs --model core --az 215 --el 22      # factory -> render
```

### Generator contract — what cost the most time to learn

The factory generator reads a specific set of fields. Four mismatches each produced a
confidently-wrong render, and every one of them was found by reading the emitted TypeScript, not by
guessing from the picture:

| Symptom | Cause |
|---|---|
| Every mesh is a unit primitive; nothing is the size it is specified to be | `scale_vector` short-circuits on `transform.scale` **if the key is present at all**. An identity `[1,1,1]` silently discards `dimensions`. Omit the key unless the scale is really non-uniform. |
| Hexagonal tiers render as smooth cylinders | `geometryDescriptor.radialSegments` is not read. Use a `lathe` with `latheProfile.segments`, authored in unit space (radius ≤ 0.5, y in -0.5..0.5); it carries rim chamfers as profile steps for free. |
| Radial rings render as unit boxes at the origin, or not at all | `repetitionSystems` are read as `{level, parent, count, primitive, material, instanceScale, placement:{mode, axis, radius, startAngleDeg}}`. A system whose `elementComponentIds` are all realised is treated as documentation and not emitted — which is what you want when the members carry per-member detail an instanced unit box cannot. |
| Emissive surfaces render dead black | `material.emissive` is read as a hex **string** and `material.emissiveIntensity` as a number. A descriptive object falls through to `#000000`. |
| A part sits a whole parent-height too high | `transform.position` is the pivot Group's **parent-local** position. Separately, `cylinder`/`cone`/`capsule`/`tube` are attachment primitives whose position comes from `attachment.localStart` instead, so their children's frames start at that endpoint. |
| The whole model sits inside a large box | An authored `root` component emits a real mesh. The validator requires root to exist, so give it a 1mm stub geometry and put its real extent on its collider. |
| Detail declared in `component.localFeatures` never appears | `localFeatures` is detail bookkeeping. Only `componentTree` entries become geometry. |

### Gate captures need transparency

`turntable_gate.py` and friends segment the subject from the background. Against an opaque backdrop
they fall back to "the whole frame is foreground", report every azimuth `unsegmented`, and would
pass without ever measuring the model. Capture gate evidence with `--bg none`:

```bash
node scripts/capture-model.mjs --model core --bg none --az 0 --az 90 --az 180 --az 270
node scripts/capture-model.mjs --model core --maps 0 --az 215   # map-stripped, for the blockout gate
```

## 3. Preview — the Model Lab

```bash
npm run dev        # then open /model-lab.html
```

Every crop in `art/models.json` is listed, grouped as the sheet groups them, and tagged with where
its 3D preview comes from: `img2threejs` (a generated factory), `in-game model` (the hand-written
one the match renders), or `reference only`. Registering a factory in
`src/game/rendering/models/generated/index.ts` under its crop name is all it takes for the lab to
pick it up.

URL parameters make any view reproducible, which is what the review loop screenshots:
`?model=core&az=215&el=22&zoom=1&maps=0&bg=none&ui=0&spin=1&grid=0`.
