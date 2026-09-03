# relay-node — deterministic crop analysis

Source `art/models/relay-node.png`, 137x153 px, subject covers 99% of the frame.

## Palette (lit → de-lit estimate)

- rgb(13, 20, 23) share 28% sat 0.54 → de-lit rgb(19, 29, 33)
- rgb(60, 62, 63) share 3% sat 0.00 → de-lit rgb(84, 87, 88)
- rgb(115, 113, 110) share 1% sat 0.02 → de-lit rgb(120, 118, 115)
- rgb(161, 156, 154) share 0% sat 0.03 → de-lit rgb(126, 123, 120)
- rgb(68, 95, 109) share 0% sat 0.45 → de-lit rgb(91, 126, 146)
- rgb(14, 39, 55) share 0% sat 0.73 → de-lit rgb(20, 55, 76)
- rgb(38, 83, 104) share 0% sat 0.64 → de-lit rgb(53, 115, 145)

## Silhouette

- 153 tall x 137 wide (aspect 1.117), left/right symmetry 0.994
- width at 12 stations top→bottom: [1.0, 1.0, 0.985, 0.956, 0.993, 1.0, 0.993, 1.0, 1.0, 1.0, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-7 (h=8, w=137): rgb(8, 17, 21) 33%; rgb(46, 48, 52) 0%; rgb(91, 97, 99) 0%; rgb(159, 155, 155) 0%; column runs 1 gaps []
- rows 10-35 (h=26, w=137): rgb(8, 17, 22) 29%; rgb(47, 58, 68) 2%; rgb(57, 95, 116) 0%; rgb(13, 41, 56) 0%; column runs 1 gaps []
- rows 38-46 (h=9, w=137): rgb(9, 18, 22) 28%; rgb(94, 93, 95) 0%; rgb(59, 67, 71) 0%; rgb(35, 155, 203) 0%; column runs 1 gaps []
- rows 47-59 (h=13, w=137): rgb(10, 20, 23) 27%; rgb(58, 65, 68) 3%; rgb(169, 166, 165) 1%; rgb(108, 108, 110) 0%; column runs 1 gaps []
- rows 60-65 (h=6, w=137): rgb(11, 20, 24) 27%; rgb(51, 59, 63) 3%; rgb(18, 46, 59) 1%; rgb(39, 88, 109) 0%; column runs 1 gaps []
- rows 66-71 (h=6, w=137): rgb(12, 21, 24) 29%; rgb(51, 55, 57) 3%; rgb(110, 107, 108) 0%; rgb(180, 174, 175) 0%; column runs 1 gaps []
- rows 73-149 (h=77, w=137): rgb(17, 23, 25) 27%; rgb(64, 62, 61) 4%; rgb(116, 114, 111) 1%; rgb(157, 153, 150) 0%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.358), np.float64(0.17), np.float64(0.533), np.float64(0.314)] rgb(47, 156, 194) 71px
- bbox(normalised) [np.float64(0.321), np.float64(0.327), np.float64(0.431), np.float64(0.418)] rgb(78, 190, 210) 16px
- bbox(normalised) [np.float64(0.285), np.float64(0.033), np.float64(0.423), np.float64(0.216)] rgb(73, 152, 174) 12px
