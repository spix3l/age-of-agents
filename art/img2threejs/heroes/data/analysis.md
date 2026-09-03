# data — deterministic crop analysis

Source `art/models/data.png`, 166x157 px, subject covers 99% of the frame.

## Palette (lit → de-lit estimate)

- rgb(9, 19, 23) share 20% sat 0.60 → de-lit rgb(13, 26, 32)
- rgb(22, 51, 64) share 7% sat 0.73 → de-lit rgb(31, 71, 90)
- rgb(64, 73, 84) share 2% sat 0.27 → de-lit rgb(89, 102, 118)
- rgb(16, 90, 112) share 1% sat 0.88 → de-lit rgb(23, 125, 157)
- rgb(46, 218, 236) share 0% sat 0.85 → de-lit rgb(36, 171, 185)
- rgb(14, 201, 225) share 0% sat 0.94 → de-lit rgb(12, 160, 179)
- rgb(15, 129, 156) share 0% sat 0.90 → de-lit rgb(18, 155, 187)

## Silhouette

- 157 tall x 166 wide (aspect 0.946), left/right symmetry 0.991
- width at 12 stations top→bottom: [1.0, 1.0, 0.958, 0.994, 0.982, 1.0, 0.994, 0.988, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-11 (h=12, w=166): rgb(7, 15, 19) 32%; rgb(67, 73, 85) 1%; rgb(34, 41, 53) 0%; column runs 1 gaps []
- rows 12-35 (h=24, w=166): rgb(8, 16, 20) 23%; rgb(70, 79, 94) 7%; rgb(34, 44, 55) 1%; rgb(82, 102, 128) 0%; column runs 1 gaps []
- rows 36-147 (h=112, w=166): rgb(11, 21, 26) 19%; rgb(20, 52, 66) 8%; rgb(12, 83, 105) 1%; rgb(53, 59, 65) 1%; column runs 1 gaps []
- rows 151-156 (h=6, w=166): rgb(10, 19, 22) 33%; rgb(42, 47, 52) 0%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.422), np.float64(0.255), np.float64(0.59), np.float64(0.433)] rgb(33, 208, 226) 304px
- bbox(normalised) [np.float64(0.476), np.float64(0.567), np.float64(0.645), np.float64(0.745)] rgb(39, 207, 228) 236px
- bbox(normalised) [np.float64(0.337), np.float64(0.522), np.float64(0.506), np.float64(0.701)] rgb(49, 213, 231) 213px
- bbox(normalised) [np.float64(0.47), np.float64(0.35), np.float64(0.608), np.float64(0.529)] rgb(35, 201, 222) 106px
- bbox(normalised) [np.float64(0.241), np.float64(0.497), np.float64(0.41), np.float64(0.675)] rgb(45, 194, 214) 106px
- bbox(normalised) [np.float64(0.536), np.float64(0.459), np.float64(0.705), np.float64(0.637)] rgb(43, 193, 213) 102px
- bbox(normalised) [np.float64(0.404), np.float64(0.707), np.float64(0.56), np.float64(0.885)] rgb(48, 193, 214) 83px
- bbox(normalised) [np.float64(0.62), np.float64(0.643), np.float64(0.747), np.float64(0.783)] rgb(61, 199, 214) 63px
- bbox(normalised) [np.float64(0.169), np.float64(0.599), np.float64(0.337), np.float64(0.777)] rgb(56, 194, 215) 36px
- bbox(normalised) [np.float64(0.241), np.float64(0.153), np.float64(0.41), np.float64(0.331)] rgb(57, 192, 215) 31px
