# heavy-foundry — deterministic crop analysis

Source `art/models/heavy-foundry.png`, 145x143 px, subject covers 100% of the frame.

## Palette (lit → de-lit estimate)

- rgb(14, 22, 24) share 27% sat 0.52 → de-lit rgb(21, 31, 34)
- rgb(56, 55, 53) share 3% sat 0.01 → de-lit rgb(78, 77, 74)
- rgb(89, 89, 87) share 1% sat 0.02 → de-lit rgb(119, 118, 116)
- rgb(145, 143, 142) share 0% sat 0.01 → de-lit rgb(119, 118, 117)
- rgb(57, 32, 18) share 0% sat 0.69 → de-lit rgb(79, 44, 25)
- rgb(180, 178, 177) share 0% sat 0.02 → de-lit rgb(141, 140, 139)
- rgb(14, 39, 55) share 0% sat 0.74 → de-lit rgb(20, 55, 77)

## Silhouette

- 143 tall x 145 wide (aspect 0.986), left/right symmetry 0.993
- width at 12 stations top→bottom: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-6 (h=7, w=145): rgb(8, 18, 22) 33%; rgb(128, 117, 112) 0%; rgb(77, 74, 73) 0%; column runs 1 gaps []
- rows 18-25 (h=8, w=145): rgb(9, 19, 22) 30%; rgb(69, 66, 63) 1%; rgb(137, 131, 125) 0%; rgb(101, 90, 87) 0%; column runs 1 gaps []
- rows 29-136 (h=108, w=145): rgb(17, 22, 25) 26%; rgb(55, 54, 52) 4%; rgb(88, 88, 87) 1%; rgb(156, 154, 155) 0%; column runs 1 gaps []
- rows 137-142 (h=6, w=145): rgb(11, 23, 26) 33%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.4), np.float64(0.392), np.float64(0.593), np.float64(0.573)] rgb(200, 163, 94) 50px
- bbox(normalised) [np.float64(0.559), np.float64(0.552), np.float64(0.697), np.float64(0.678)] rgb(219, 162, 73) 26px
