# Reference suitability — Core

**Verdict: conditional → proceed as a stylized reconstruction.**

Against `grimoire/intake/validation_rubric.md`:

Pass criteria met: one obvious target object; it fills the frame; the silhouette is strong and
unambiguous; the major materials (dark steel, silver trim, dark glass, two emissive hues) are all
visible; the form is radially symmetric so the hidden hemisphere can be inferred from the visible
arc; every part maps onto procedural primitives (hexagonal prisms, rounded cuboids, a torus, a
chamfered frustum).

Conditional criteria that apply:
- **one view only, but the object has rotational symmetry** — the rear is inferred from 6-fold
  radial repetition, not observed.
- **low resolution.** `probe_image.py` returns `technicalSuitability: conditional` at 156 x 199 px.
  This is the native size of the cell on the source sheet, so no better crop exists. Consequence:
  micro detail (bolt heads, the 3-dot status panels, panel seam widths) is 1–3 px wide and is
  reconstructed as *plausible* rather than *measured*. Recorded as a stated approximation.
- **the axial beam is volumeless light**, not a surface. It is reconstructed as additive
  emissive geometry, which is a representation choice, not a measurement.

No reject criterion applies: the target is not a scene, nothing load-bearing is cropped, and the
request does not demand mesh extraction or manufacturing dimensions.

Stylization the user gets, stated up front: a hard-surface, low-poly-friendly game prop that
matches silhouette, tier proportions, material families, and emissive layout — not a pixel match
of the painted detail.
