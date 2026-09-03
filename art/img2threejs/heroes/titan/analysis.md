# titan — deterministic crop analysis

Source `art/models/titan.png`, 144x124 px, subject covers 99% of the frame.

## Palette (lit → de-lit estimate)

- rgb(12, 21, 25) share 27% sat 0.64 → de-lit rgb(18, 30, 35)
- rgb(61, 63, 64) share 3% sat 0.01 → de-lit rgb(85, 89, 89)
- rgb(109, 111, 110) share 1% sat 0.01 → de-lit rgb(117, 119, 118)
- rgb(169, 168, 167) share 0% sat 0.02 → de-lit rgb(133, 131, 131)
- rgb(16, 39, 56) share 0% sat 0.70 → de-lit rgb(23, 55, 78)
- rgb(152, 148, 136) share 0% sat 0.10 → de-lit rgb(121, 118, 109)
- rgb(58, 85, 105) share 0% sat 0.45 → de-lit rgb(81, 119, 146)

## Silhouette

- 124 tall x 144 wide (aspect 0.861), left/right symmetry 0.983
- width at 12 stations top→bottom: [1.0, 0.986, 0.972, 0.931, 1.0, 0.993, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-10 (h=11, w=144): rgb(9, 22, 26) 33%; rgb(143, 157, 171) 0%; rgb(59, 62, 63) 0%; rgb(181, 184, 197) 0%; column runs 1 gaps []
- rows 11-106 (h=96, w=144): rgb(13, 22, 25) 26%; rgb(60, 64, 65) 3%; rgb(107, 107, 106) 0%; rgb(180, 178, 177) 0%; column runs 1 gaps []
- rows 110-123 (h=14, w=144): rgb(9, 21, 25) 32%; rgb(70, 67, 65) 2%; rgb(114, 112, 107) 0%; column runs 1 gaps []
