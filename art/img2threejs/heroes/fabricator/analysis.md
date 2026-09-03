# fabricator — deterministic crop analysis

Source `art/models/fabricator.png`, 145x137 px, subject covers 100% of the frame.

## Palette (lit → de-lit estimate)

- rgb(13, 21, 24) share 25% sat 0.55 → de-lit rgb(19, 30, 34)
- rgb(65, 65, 66) share 3% sat 0.01 → de-lit rgb(91, 91, 93)
- rgb(29, 42, 60) share 2% sat 0.41 → de-lit rgb(41, 59, 84)
- rgb(114, 114, 114) share 1% sat 0.01 → de-lit rgb(118, 118, 118)
- rgb(157, 154, 153) share 0% sat 0.02 → de-lit rgb(123, 121, 120)
- rgb(85, 90, 101) share 0% sat 0.16 → de-lit rgb(111, 118, 133)
- rgb(11, 60, 104) share 0% sat 0.89 → de-lit rgb(16, 83, 145)

## Silhouette

- 137 tall x 145 wide (aspect 0.945), left/right symmetry 0.994
- width at 12 stations top→bottom: [1.0, 1.0, 0.993, 1.0, 1.0, 0.979, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-16 (h=17, w=145): rgb(8, 18, 22) 33%; rgb(59, 61, 64) 0%; rgb(126, 124, 123) 0%; rgb(159, 159, 157) 0%; column runs 1 gaps []
- rows 20-60 (h=41, w=145): rgb(11, 20, 24) 23%; rgb(73, 71, 72) 2%; rgb(158, 154, 153) 1%; rgb(32, 40, 55) 1%; column runs 1 gaps []
- rows 63-66 (h=4, w=145): rgb(13, 22, 29) 23%; rgb(19, 52, 83) 3%; rgb(81, 73, 63) 2%; rgb(111, 107, 106) 0%; column runs 1 gaps []
- rows 70-130 (h=61, w=145): rgb(16, 23, 26) 25%; rgb(66, 66, 66) 3%; rgb(106, 105, 106) 1%; rgb(33, 57, 84) 0%; column runs 1 gaps []
- rows 131-136 (h=6, w=145): rgb(11, 22, 26) 33%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.152), np.float64(0.504), np.float64(0.345), np.float64(0.679)] rgb(234, 173, 58) 55px
- bbox(normalised) [np.float64(0.552), np.float64(0.321), np.float64(0.703), np.float64(0.504)] rgb(151, 173, 129) 45px
- bbox(normalised) [np.float64(0.372), np.float64(0.365), np.float64(0.503), np.float64(0.496)] rgb(60, 154, 203) 43px
- bbox(normalised) [np.float64(0.255), np.float64(0.073), np.float64(0.352), np.float64(0.219)] rgb(185, 124, 43) 6px
