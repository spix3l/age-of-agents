# ranger — deterministic crop analysis

Source `art/models/ranger.png`, 100x108 px, subject covers 98% of the frame.

## Palette (lit → de-lit estimate)

- rgb(11, 22, 26) share 29% sat 0.65 → de-lit rgb(16, 31, 37)
- rgb(51, 58, 62) share 2% sat 0.04 → de-lit rgb(72, 81, 87)
- rgb(94, 95, 96) share 1% sat 0.01 → de-lit rgb(117, 118, 119)
- rgb(138, 140, 140) share 1% sat 0.00 → de-lit rgb(117, 118, 119)
- rgb(177, 178, 178) share 0% sat 0.01 → de-lit rgb(138, 139, 139)
- rgb(13, 58, 74) share 0% sat 0.84 → de-lit rgb(19, 81, 103)
- rgb(17, 87, 104) share 0% sat 0.83 → de-lit rgb(24, 121, 145)

## Silhouette

- 108 tall x 100 wide (aspect 1.08), left/right symmetry 0.964
- width at 12 stations top→bottom: [1.0, 0.93, 0.89, 0.97, 0.99, 1.0, 1.0, 0.99, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-14 (h=15, w=100): rgb(9, 23, 28) 31%; rgb(80, 82, 85) 1%; rgb(14, 72, 89) 0%; rgb(133, 134, 131) 0%; column runs 1 gaps []
- rows 15-20 (h=6, w=100): rgb(10, 23, 28) 25%; rgb(182, 179, 177) 1%; rgb(134, 131, 130) 1%; rgb(83, 83, 83) 1%; column runs 1 gaps []
- rows 22-72 (h=51, w=100): rgb(14, 24, 28) 27%; rgb(67, 68, 68) 2%; rgb(155, 155, 155) 1%; rgb(106, 106, 106) 1%; column runs 1 gaps []
- rows 75-81 (h=7, w=100): rgb(12, 24, 29) 30%; rgb(48, 54, 57) 1%; rgb(117, 119, 120) 1%; rgb(83, 85, 87) 0%; column runs 1 gaps []
- rows 85-88 (h=4, w=100): rgb(9, 19, 23) 29%; rgb(58, 62, 63) 3%; rgb(110, 113, 114) 1%; column runs 1 gaps []
- rows 89-107 (h=19, w=100): rgb(8, 18, 22) 32%; rgb(57, 57, 56) 1%; rgb(117, 117, 114) 0%; column runs 1 gaps []
