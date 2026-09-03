# energy — deterministic crop analysis

Source `art/models/energy.png`, 143x145 px, subject covers 98% of the frame.

## Palette (lit → de-lit estimate)

- rgb(13, 15, 30) share 20% sat 0.59 → de-lit rgb(19, 22, 42)
- rgb(41, 21, 73) share 3% sat 0.74 → de-lit rgb(58, 30, 102)
- rgb(91, 37, 170) share 3% sat 0.82 → de-lit rgb(127, 52, 237)
- rgb(61, 23, 117) share 3% sat 0.84 → de-lit rgb(85, 33, 164)
- rgb(114, 49, 199) share 1% sat 0.80 → de-lit rgb(157, 68, 255)
- rgb(143, 70, 226) share 1% sat 0.73 → de-lit rgb(154, 75, 243)
- rgb(177, 108, 231) share 0% sat 0.53 → de-lit rgb(146, 89, 191)

## Silhouette

- 145 tall x 143 wide (aspect 1.014), left/right symmetry 0.973
- width at 12 stations top→bottom: [1.0, 0.965, 0.93, 0.986, 0.972, 0.979, 0.993, 1.0, 1.0, 0.979, 1.0, 1.0]

## Bands (top → bottom)

- rows 0-136 (h=137, w=143): rgb(12, 15, 30) 18%; rgb(39, 20, 73) 3%; rgb(53, 17, 108) 1%; rgb(86, 32, 180) 1%; column runs 1 gaps []
- rows 137-143 (h=7, w=143): rgb(18, 19, 30) 32%; rgb(54, 39, 73) 1%; rgb(103, 71, 144) 0%; rgb(77, 53, 107) 0%; column runs 1 gaps []

## Emissive regions

- bbox(normalised) [np.float64(0.217), np.float64(0.331), np.float64(0.413), np.float64(0.524)] rgb(98, 44, 196) 382px
- bbox(normalised) [np.float64(0.287), np.float64(0.228), np.float64(0.483), np.float64(0.421)] rgb(113, 51, 209) 293px
- bbox(normalised) [np.float64(0.336), np.float64(0.11), np.float64(0.531), np.float64(0.303)] rgb(109, 47, 208) 280px
- bbox(normalised) [np.float64(0.441), np.float64(0.276), np.float64(0.636), np.float64(0.469)] rgb(102, 44, 199) 257px
- bbox(normalised) [np.float64(0.476), np.float64(0.166), np.float64(0.601), np.float64(0.359)] rgb(113, 51, 214) 213px
- bbox(normalised) [np.float64(0.308), np.float64(0.683), np.float64(0.503), np.float64(0.876)] rgb(132, 58, 209) 213px
- bbox(normalised) [np.float64(0.643), np.float64(0.214), np.float64(0.804), np.float64(0.407)] rgb(142, 71, 210) 191px
- bbox(normalised) [np.float64(0.077), np.float64(0.179), np.float64(0.273), np.float64(0.372)] rgb(146, 77, 210) 180px
- bbox(normalised) [np.float64(0.72), np.float64(0.586), np.float64(0.888), np.float64(0.779)] rgb(127, 65, 181) 138px
- bbox(normalised) [np.float64(0.378), 0.0, np.float64(0.566), np.float64(0.152)] rgb(155, 77, 231) 134px
