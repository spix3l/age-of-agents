# defense-turret — deterministic crop analysis

Source `art/models/defense-turret.png`, 124x147 px, subject covers 99% of the frame.

## Palette (lit → de-lit estimate)

- rgb(13, 20, 23) share 27% sat 0.55 → de-lit rgb(18, 28, 33)
- rgb(59, 63, 67) share 3% sat 0.05 → de-lit rgb(82, 88, 93)
- rgb(107, 109, 112) share 1% sat 0.01 → de-lit rgb(117, 118, 121)
- rgb(12, 48, 64) share 0% sat 0.78 → de-lit rgb(17, 67, 89)
- rgb(165, 164, 166) share 0% sat 0.01 → de-lit rgb(130, 128, 130)
- rgb(36, 119, 142) share 0% sat 0.76 → de-lit rgb(44, 145, 173)
- rgb(13, 83, 108) share 0% sat 0.88 → de-lit rgb(18, 117, 150)

## Silhouette

- 147 tall x 124 wide (aspect 1.185), left/right symmetry 0.985
- width at 12 stations top→bottom: [1.0, 0.927, 0.968, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-6 (h=7, w=124): rgb(7, 15, 19) 33%; rgb(65, 64, 70) 0%; rgb(126, 127, 126) 0%; column runs 1 gaps []
- rows 7-15 (h=9, w=124): rgb(8, 16, 20) 28%; rgb(118, 119, 124) 1%; rgb(67, 68, 74) 1%; rgb(179, 177, 181) 0%; column runs 1 gaps []
- rows 16-20 (h=5, w=124): rgb(8, 16, 20) 21%; rgb(180, 177, 180) 1%; rgb(15, 42, 56) 1%; rgb(107, 106, 111) 1%; column runs 1 gaps []
- rows 21-31 (h=11, w=124): rgb(11, 19, 23) 25%; rgb(67, 69, 75) 4%; rgb(117, 116, 117) 1%; rgb(181, 175, 179) 0%; column runs 1 gaps []
- rows 32-35 (h=4, w=124): rgb(13, 21, 25) 24%; rgb(51, 57, 59) 2%; rgb(81, 231, 245) 1%; rgb(33, 183, 203) 1%; column runs 2 gaps [2]
- rows 36-62 (h=27, w=124): rgb(12, 19, 22) 29%; rgb(62, 64, 66) 2%; rgb(118, 117, 118) 0%; rgb(10, 40, 52) 0%; column runs 1 gaps []
- rows 63-66 (h=4, w=124): rgb(10, 18, 21) 28%; rgb(70, 71, 76) 2%; rgb(39, 46, 55) 1%; rgb(6, 63, 88) 0%; column runs 1 gaps []
- rows 71-128 (h=58, w=124): rgb(17, 23, 26) 26%; rgb(62, 64, 65) 5%; rgb(107, 107, 109) 1%; rgb(152, 155, 157) 0%; column runs 1 gaps []
- rows 129-146 (h=18, w=124): rgb(9, 20, 23) 31%; rgb(36, 66, 72) 2%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.226), np.float64(0.129), np.float64(0.452), np.float64(0.252)] rgb(74, 198, 215) 39px
- bbox(normalised) [np.float64(0.613), 0.0, np.float64(0.726), np.float64(0.143)] rgb(49, 188, 208) 33px
- bbox(normalised) [np.float64(0.274), np.float64(0.34), np.float64(0.484), np.float64(0.49)] rgb(63, 169, 194) 14px
- bbox(normalised) [np.float64(0.395), np.float64(0.646), np.float64(0.621), np.float64(0.741)] rgb(81, 172, 202) 6px
