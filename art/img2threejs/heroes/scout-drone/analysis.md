# scout-drone — deterministic crop analysis

Source `art/models/scout-drone.png`, 115x80 px, subject covers 98% of the frame.

## Palette (lit → de-lit estimate)

- rgb(11, 21, 25) share 28% sat 0.63 → de-lit rgb(16, 30, 36)
- rgb(64, 69, 72) share 2% sat 0.07 → de-lit rgb(90, 96, 100)
- rgb(114, 117, 119) share 1% sat 0.03 → de-lit rgb(116, 118, 121)
- rgb(164, 165, 165) share 1% sat 0.01 → de-lit rgb(128, 129, 130)
- rgb(15, 58, 72) share 0% sat 0.81 → de-lit rgb(21, 82, 100)
- rgb(83, 113, 131) share 0% sat 0.36 → de-lit rgb(93, 126, 146)
- rgb(112, 200, 226) share 0% sat 0.50 → de-lit rgb(88, 157, 177)

## Silhouette

- 80 tall x 115 wide (aspect 0.696), left/right symmetry 0.957
- width at 12 stations top→bottom: [1.0, 1.0, 0.983, 1.0, 0.974, 0.93, 0.861, 0.948, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-7 (h=8, w=115): rgb(9, 21, 25) 33%; rgb(81, 84, 88) 0%; rgb(159, 157, 161) 0%; rgb(47, 51, 56) 0%; column runs 1 gaps []
- rows 8-50 (h=43, w=115): rgb(11, 22, 26) 24%; rgb(93, 94, 96) 3%; rgb(56, 58, 61) 1%; rgb(130, 130, 132) 1%; column runs 1 gaps []
- rows 51-57 (h=7, w=115): rgb(12, 24, 28) 27%; rgb(47, 61, 63) 2%; rgb(14, 56, 65) 0%; rgb(108, 223, 230) 0%; column runs 1 gaps []
- rows 61-79 (h=19, w=115): rgb(9, 19, 23) 32%; rgb(55, 58, 60) 1%; rgb(105, 109, 110) 0%; rgb(136, 137, 137) 0%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.365), np.float64(0.5), np.float64(0.53), np.float64(0.688)] rgb(88, 201, 209) 18px
- bbox(normalised) [np.float64(0.348), np.float64(0.162), np.float64(0.504), np.float64(0.388)] rgb(97, 175, 208) 12px
