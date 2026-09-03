# striker — deterministic crop analysis

Source `art/models/striker.png`, 118x109 px, subject covers 98% of the frame.

## Palette (lit → de-lit estimate)

- rgb(10, 23, 28) share 28% sat 0.69 → de-lit rgb(15, 32, 40)
- rgb(58, 64, 69) share 2% sat 0.08 → de-lit rgb(81, 90, 97)
- rgb(106, 110, 114) share 1% sat 0.02 → de-lit rgb(115, 119, 123)
- rgb(12, 52, 89) share 0% sat 0.83 → de-lit rgb(17, 73, 124)
- rgb(168, 167, 166) share 0% sat 0.00 → de-lit rgb(131, 131, 130)
- rgb(46, 89, 118) share 0% sat 0.44 → de-lit rgb(65, 125, 164)
- rgb(31, 87, 151) share 0% sat 0.79 → de-lit rgb(44, 122, 210)

## Silhouette

- 109 tall x 118 wide (aspect 0.924), left/right symmetry 0.966
- width at 12 stations top→bottom: [1.0, 0.992, 0.924, 0.975, 0.966, 0.983, 1.0, 0.949, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-15 (h=16, w=118): rgb(9, 23, 29) 31%; rgb(115, 115, 118) 0%; rgb(60, 60, 65) 0%; rgb(181, 179, 180) 0%; column runs 1 gaps []
- rows 16-19 (h=4, w=118): rgb(9, 23, 29) 27%; rgb(57, 68, 75) 2%; rgb(168, 170, 171) 1%; rgb(114, 126, 127) 0%; column runs 2 gaps [3]
- rows 23-37 (h=15, w=118): rgb(13, 25, 31) 24%; rgb(65, 67, 68) 3%; rgb(108, 107, 108) 0%; rgb(10, 52, 83) 0%; column runs 1 gaps []
- rows 38-56 (h=19, w=118): rgb(13, 24, 31) 26%; rgb(57, 64, 70) 2%; rgb(12, 50, 90) 1%; rgb(108, 108, 110) 0%; column runs 1 gaps []
- rows 60-71 (h=12, w=118): rgb(11, 24, 30) 26%; rgb(63, 69, 74) 3%; rgb(119, 120, 120) 1%; rgb(153, 154, 150) 0%; column runs 1 gaps []
- rows 72-89 (h=18, w=118): rgb(10, 22, 28) 30%; rgb(59, 64, 67) 3%; rgb(116, 118, 117) 0%; rgb(160, 158, 152) 0%; column runs 1 gaps []
- rows 91-108 (h=18, w=118): rgb(8, 20, 25) 32%; rgb(59, 67, 74) 1%; rgb(99, 108, 117) 0%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.076), np.float64(0.248), np.float64(0.28), np.float64(0.404)] rgb(60, 147, 203) 41px
- bbox(normalised) [np.float64(0.78), np.float64(0.349), np.float64(0.941), np.float64(0.541)] rgb(49, 121, 189) 33px
