# Art pipeline: asset sheet → per-model crops

The reference art is reproducible from the command line; nothing here is hand-placed.

```
art/reference/asset-sheet.png          the source sheet (1536 x 1024)
        │  python3 art/extract_models.py
        ▼
art/models/*.png  +  art/models.json   68 per-model crops and their sheet boxes
```

The crops are the visual reference the hand-written procedural models in
`src/game/rendering/models/` are built against.

## Extraction — `art/extract_models.py`

The sheet is panels of models in labelled rows. Rather than hand-tuning 68 boxes, each row is
declared as a **band** (a rectangle containing only art, no label text) plus the ordered names of
the models in it. The band is split on the empty columns between models and each crop tightened to
the ink, so a slightly-wrong band still yields a correct crop. Re-run it any time:

```bash
python3 art/extract_models.py     # rewrites art/models/ and art/models.json
```

It exits non-zero and names the band if a row yields a different number of models than declared —
so a mis-declared band fails loudly instead of writing silent garbage.

## Review

`?scenario=showcase` in the game renders one finished colony with every structure and unit, which
is the fixture the art review screenshots:

```bash
npm run build && node scripts/capture-scene.mjs --scenario showcase --out art/review
```
