# matter — deterministic crop analysis

Source `art/models/matter.png`, 153x144 px, subject covers 99% of the frame.

## Palette (lit → de-lit estimate)

- rgb(11, 21, 28) share 22% sat 0.64 → de-lit rgb(16, 30, 40)
- rgb(38, 49, 70) share 4% sat 0.43 → de-lit rgb(53, 68, 97)
- rgb(74, 85, 112) share 3% sat 0.27 → de-lit rgb(103, 118, 156)
- rgb(28, 55, 112) share 1% sat 0.65 → de-lit rgb(40, 78, 157)
- rgb(92, 104, 154) share 1% sat 0.46 → de-lit rgb(103, 115, 171)
- rgb(14, 83, 156) share 0% sat 0.91 → de-lit rgb(21, 115, 217)
- rgb(125, 136, 178) share 0% sat 0.30 → de-lit rgb(108, 116, 153)

## Silhouette

- 144 tall x 153 wide (aspect 0.941), left/right symmetry 0.994
- width at 12 stations top→bottom: [1.0, 1.0, 1.0, 0.98, 1.0, 1.0, 1.0, 0.922, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-116 (h=117, w=153): rgb(12, 22, 31) 22%; rgb(69, 81, 105) 3%; rgb(33, 49, 78) 2%; rgb(83, 103, 155) 0%; column runs 1 gaps []
- rows 117-137 (h=21, w=153): rgb(16, 23, 28) 29%; rgb(63, 68, 77) 3%; rgb(85, 93, 111) 1%; rgb(13, 54, 79) 0%; column runs 1 gaps []
- rows 138-143 (h=6, w=153): rgb(13, 22, 26) 33%; rgb(51, 59, 64) 0%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.379), np.float64(0.472), np.float64(0.562), np.float64(0.667)] rgb(39, 139, 205) 212px
- bbox(normalised) [np.float64(0.314), np.float64(0.111), np.float64(0.497), np.float64(0.306)] rgb(41, 127, 206) 205px
- bbox(normalised) [np.float64(0.431), np.float64(0.028), np.float64(0.523), np.float64(0.222)] rgb(53, 147, 214) 101px
- bbox(normalised) [np.float64(0.353), np.float64(0.215), np.float64(0.497), np.float64(0.382)] rgb(65, 143, 214) 96px
- bbox(normalised) [np.float64(0.092), np.float64(0.611), np.float64(0.209), np.float64(0.736)] rgb(34, 176, 220) 37px
- bbox(normalised) [np.float64(0.052), np.float64(0.458), np.float64(0.19), np.float64(0.576)] rgb(45, 166, 217) 35px
- bbox(normalised) [np.float64(0.621), np.float64(0.708), np.float64(0.725), np.float64(0.819)] rgb(33, 161, 201) 33px
- bbox(normalised) [np.float64(0.209), np.float64(0.674), np.float64(0.32), np.float64(0.785)] rgb(47, 177, 222) 32px
- bbox(normalised) [np.float64(0.647), np.float64(0.354), np.float64(0.739), np.float64(0.458)] rgb(54, 131, 209) 14px
