# worker-agent — deterministic crop analysis

Source `art/models/worker-agent.png`, 79x105 px, subject covers 96% of the frame.

## Palette (lit → de-lit estimate)

- rgb(10, 20, 23) share 26% sat 0.62 → de-lit rgb(15, 28, 33)
- rgb(65, 69, 71) share 3% sat 0.05 → de-lit rgb(91, 96, 100)
- rgb(109, 112, 113) share 1% sat 0.01 → de-lit rgb(116, 119, 120)
- rgb(165, 166, 166) share 0% sat 0.02 → de-lit rgb(129, 130, 130)
- rgb(22, 50, 72) share 0% sat 0.75 → de-lit rgb(31, 70, 100)
- rgb(45, 88, 117) share 0% sat 0.67 → de-lit rgb(63, 122, 163)
- rgb(58, 130, 178) share 0% sat 0.67 → de-lit rgb(60, 135, 184)

## Silhouette

- 105 tall x 79 wide (aspect 1.329), left/right symmetry 0.966
- width at 12 stations top→bottom: [1.0, 1.0, 1.0, 0.696, 0.937, 1.0, 0.975, 0.987, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-24 (h=25, w=79): rgb(9, 20, 24) 30%; rgb(15, 39, 59) 0%; rgb(34, 88, 133) 0%; rgb(58, 128, 179) 0%; column runs 1 gaps []
- rows 25-41 (h=17, w=79): rgb(11, 20, 24) 21%; rgb(165, 165, 165) 3%; rgb(119, 121, 122) 2%; rgb(57, 60, 63) 1%; column runs 1 gaps []
- rows 45-98 (h=54, w=79): rgb(11, 19, 23) 26%; rgb(66, 69, 71) 5%; rgb(106, 109, 110) 1%; rgb(179, 179, 178) 0%; column runs 1 gaps []
- rows 99-104 (h=6, w=79): rgb(9, 19, 23) 33%; rgb(58, 57, 58) 0%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.316), 0.0, np.float64(0.646), np.float64(0.19)] rgb(74, 151, 203) 53px
- bbox(normalised) [np.float64(0.405), np.float64(0.257), np.float64(0.747), np.float64(0.429)] rgb(48, 145, 180) 20px
