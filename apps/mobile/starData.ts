/**
 * Compact star and constellation data for React Native starfield rendering.
 *
 * Star coordinates sourced from the Hipparcos Main Catalogue (ESA 1997),
 * retrieved via VizieR (CDS, Strasbourg). RA/Dec are in decimal degrees,
 * epoch J2000.0.
 *
 * Constellation line coordinates sourced from d3-celestial by Olaf Frohn
 * (https://github.com/ofrohn/d3-celestial), which uses RA in decimal degrees
 * (NOT hours) and Dec in decimal degrees for its GeoJSON MultiLineString nodes.
 *
 * Star names sourced from IAU Working Group on Star Names (WGSN) and
 * traditional usage cross-referenced against the Hipparcos catalog.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Star {
  /** Hipparcos catalog number */
  hip: number;
  /** Common proper name (empty string if none) */
  name: string;
  /** Right Ascension, decimal degrees, J2000 */
  ra: number;
  /** Declination, decimal degrees, J2000 */
  dec: number;
  /** Johnson V apparent magnitude */
  mag: number;
}

export interface ConstellationLines {
  /** IAU 3-letter constellation abbreviation */
  id: string;
  /**
   * Array of polyline segments. Each segment is an array of [ra, dec] nodes
   * (RA in decimal degrees, Dec in decimal degrees). Draw lines connecting
   * consecutive nodes within each segment.
   */
  lines: [number, number][][];
}

// ---------------------------------------------------------------------------
// BRIGHT STARS  (magnitude < 2.5, sorted brightest first)
// Source: Hipparcos Main Catalogue I/239/hip_main via VizieR
// RA/Dec: decimal degrees, J2000.0
// ---------------------------------------------------------------------------

export const BRIGHT_STARS: Star[] = [
  // mag < 1.0 — the very brightest
  { hip: 32349, name: "Sirius",    ra: 101.2872, dec: -16.7161, mag: -1.44 }, // α CMa
  { hip: 30438, name: "Canopus",   ra:  95.9880, dec: -52.6957, mag: -0.62 }, // α Car
  { hip: 69673, name: "Arcturus",  ra: 213.9153, dec: +19.1824, mag: -0.05 }, // α Boo
  { hip: 71683, name: "Rigil Kentaurus", ra: 219.9021, dec: -60.8340, mag: -0.01 }, // α Cen A
  { hip: 91262, name: "Vega",      ra: 279.2347, dec: +38.7837, mag:  0.03 }, // α Lyr
  { hip: 24608, name: "Capella",   ra:  79.1723, dec: +45.9980, mag:  0.08 }, // α Aur
  { hip: 24436, name: "Rigel",     ra:  78.6345, dec:  -8.2016, mag:  0.18 }, // β Ori
  { hip: 37279, name: "Procyon",   ra: 114.8255, dec:  +5.2250, mag:  0.40 }, // α CMi
  { hip:  7588, name: "Achernar",  ra:  24.4285, dec: -57.2368, mag:  0.45 }, // α Eri
  { hip: 27989, name: "Betelgeuse",ra:  88.7929, dec:  +7.4071, mag:  0.45 }, // α Ori (var ~0.0–1.3)
  { hip: 68702, name: "Hadar",     ra: 210.9559, dec: -60.3730, mag:  0.61 }, // β Cen
  { hip: 97649, name: "Altair",    ra: 297.6958, dec:  +8.8683, mag:  0.76 }, // α Aql
  { hip: 60718, name: "Acrux",     ra: 186.6496, dec: -63.0991, mag:  0.77 }, // α Cru
  { hip: 21421, name: "Aldebaran", ra:  68.9802, dec: +16.5093, mag:  0.87 }, // α Tau
  { hip: 65474, name: "Spica",     ra: 201.2982, dec: -11.1613, mag:  0.98 }, // α Vir

  // mag 1.0 – 1.5
  { hip: 80763, name: "Antares",   ra: 247.3519, dec: -26.4320, mag:  1.06 }, // α Sco
  { hip: 37826, name: "Pollux",    ra: 116.3290, dec: +28.0262, mag:  1.16 }, // β Gem
  { hip:113368, name: "Fomalhaut", ra: 344.4127, dec: -29.6222, mag:  1.17 }, // α PsA
  { hip: 62434, name: "Mimosa",    ra: 191.9303, dec: -59.6888, mag:  1.25 }, // β Cru
  { hip:102098, name: "Deneb",     ra: 310.3580, dec: +45.2803, mag:  1.25 }, // α Cyg
  { hip: 71681, name: "Toliman",   ra: 219.8962, dec: -60.8372, mag:  1.35 }, // α Cen B
  { hip: 49669, name: "Regulus",   ra: 152.0930, dec: +11.9672, mag:  1.36 }, // α Leo
  { hip: 33579, name: "Adhara",    ra: 104.6565, dec: -28.9721, mag:  1.50 }, // ε CMa

  // mag 1.5 – 2.0
  { hip: 36850, name: "Castor",    ra: 113.6494, dec: +31.8883, mag:  1.58 }, // α Gem
  { hip: 61084, name: "Gacrux",    ra: 187.7915, dec: -57.1132, mag:  1.59 }, // γ Cru
  { hip: 85927, name: "Shaula",    ra: 263.4022, dec: -37.1038, mag:  1.62 }, // λ Sco
  { hip: 25336, name: "Mintaka",   ra:  81.2828, dec:  +6.3497, mag:  1.64 }, // δ Ori  (Orion's Belt)
  { hip: 25428, name: "Alnath",    ra:  81.5730, dec: +28.6075, mag:  1.65 }, // β Tau
  { hip: 45238, name: "Miaplacidus",ra:138.2999, dec: -69.7172, mag:  1.67 }, // β Car
  { hip: 26311, name: "Alnilam",   ra:  84.0534, dec:  -1.2019, mag:  1.69 }, // ε Ori  (Orion's Belt)
  { hip:109268, name: "Alnair",    ra: 332.0583, dec: -46.9610, mag:  1.73 }, // α Gru
  { hip: 26727, name: "Alnitak",   ra:  85.1897, dec:  -1.9426, mag:  1.74 }, // ζ Ori  (Orion's Belt)
  { hip: 39953, name: "Avior",     ra: 122.3831, dec: -47.3366, mag:  1.75 }, // ε Car
  { hip: 62956, name: "Alioth",    ra: 193.5073, dec: +55.9598, mag:  1.76 }, // ε UMa
  { hip: 15863, name: "Mirfak",    ra:  51.0807, dec: +49.8612, mag:  1.79 }, // α Per
  { hip: 90185, name: "Kaus Australis",ra:276.0430,dec:-34.3846,mag: 1.79 }, // ε Sgr
  { hip: 54061, name: "Dubhe",     ra: 165.9320, dec: +61.7510, mag:  1.81 }, // α UMa
  { hip: 34444, name: "Wezen",     ra: 107.0979, dec: -26.3932, mag:  1.83 }, // δ CMa
  { hip: 67301, name: "Alkaid",    ra: 206.8852, dec: +49.3133, mag:  1.85 }, // η UMa
  { hip: 41037, name: "Naos",      ra: 125.6285, dec: -59.5095, mag:  1.86 }, // ζ Pup
  { hip: 86228, name: "Sargas",    ra: 264.3297, dec: -42.9978, mag:  1.86 }, // θ Sco
  { hip: 28360, name: "Menkalinan",  ra:  89.8822, dec: +44.9474, mag:  1.90 }, // β Aur
  { hip: 82273, name: "Atria",     ra: 252.1662, dec: -69.0277, mag:  1.91 }, // α TrA
  { hip: 31681, name: "Alhena",    ra:  99.4279, dec: +16.3993, mag:  1.93 }, // γ Gem
  { hip: 42913, name: "Velorum",   ra: 131.1759, dec: -54.7088, mag:  1.93 }, // γ Vel
  { hip:100751, name: "Peacock",   ra: 306.4119, dec: -56.7351, mag:  1.94 }, // α Pav

  // mag 2.0 – 2.5
  { hip: 11767, name: "Polaris",   ra:  37.9545, dec: +89.2641, mag:  1.97 }, // α UMi
  { hip: 30324, name: "Mirzam",    ra:  95.6749, dec: -17.9559, mag:  1.98 }, // β CMa
  { hip: 46390, name: "Alphard",   ra: 141.8968, dec:  -8.6586, mag:  1.99 }, // α Hya
  { hip:  9884, name: "Hamal",     ra:  31.7934, dec: +23.4624, mag:  2.01 }, // α Ari
  { hip: 50583, name: "Algieba",   ra: 154.9931, dec: +19.8415, mag:  2.01 }, // γ Leo
  { hip:  3419, name: "Diphda",    ra:  10.8974, dec: -17.9866, mag:  2.04 }, // β Cet
  { hip: 92855, name: "Nunki",     ra: 283.8164, dec: -26.2967, mag:  2.05 }, // σ Sgr
  { hip: 68933, name: "Muhlifain", ra: 211.6706, dec: -36.3700, mag:  2.06 }, // γ Cen
  { hip:   677, name: "Alpheratz", ra:   2.0969, dec: +29.0904, mag:  2.07 }, // α And
  { hip:  5447, name: "Mirach",    ra:  17.4330, dec: +35.6206, mag:  2.07 }, // β And
  { hip: 27366, name: "Saiph",     ra:  86.9391, dec:  -9.6696, mag:  2.07 }, // κ Ori
  { hip: 72607, name: "Kochab",    ra: 222.6764, dec: +74.1555, mag:  2.07 }, // β UMi
  { hip:112122, name: "Al Dhanab", ra: 340.6669, dec: -46.8846, mag:  2.07 }, // β Gru
  { hip: 86032, name: "Rasalhague",ra: 263.7336, dec: +12.5600, mag:  2.08 }, // α Oph
];

// ---------------------------------------------------------------------------
// CONSTELLATION LINE DATA for 8 major constellations
// Source: d3-celestial by Olaf Frohn (github.com/ofrohn/d3-celestial)
// Each segment is an array of [RA, Dec] nodes in decimal degrees.
// Draw lines between consecutive points within each segment.
// Note: RA values can be negative (d3-celestial wraps RA to [-180, 180]).
// To convert to standard [0, 360): if ra < 0, add 360.
// ---------------------------------------------------------------------------

export const CONSTELLATION_LINES: ConstellationLines[] = [
  {
    id: "Ori", // Orion
    lines: [
      // Betelgeuse → Bellatrix area / shoulders
      [[91.893, 14.7685], [88.5958, 20.2762], [90.9799, 20.1385], [92.985, 14.2088],
       [90.5958, 9.6473], [88.7929, 7.4071], [81.2828, 6.3497], [73.7239, 10.1508]],
      // Left arm / Meissa area
      [[74.6371, 1.714], [73.5629, 2.4407], [72.8015, 5.6051], [72.46, 6.9613],
       [72.653, 8.9002], [73.7239, 10.1508], [74.0928, 13.5145], [76.1423, 15.4041], [77.4248, 15.5972]],
      // Belt and lower body: Saiph–Rigel–Alnilam–Alnitak
      [[78.6345, -8.2016], [81.1192, -2.3971], [83.0017, -0.2991], [81.2828, 6.3497],
       [83.7845, 9.9342], [88.7929, 7.4071], [85.1897, -1.9426], [86.9391, -9.6696]],
      // Belt cross-link
      [[85.1897, -1.9426], [84.0534, -1.2019], [83.0017, -0.2991]],
    ],
  },
  {
    id: "UMa", // Ursa Major (Big Dipper + legs)
    lines: [
      // Bowl of the Big Dipper + handle
      [[-176.1435, 57.0326], [165.932, 61.751], [165.4603, 56.3824],
       [178.4577, 53.6948], [-176.1435, 57.0326], [-166.4927, 55.9598],
       [-159.0186, 54.9254], [-153.1148, 49.3133]],
      // Merak to Dubhe down to Phad
      [[178.4577, 53.6948], [176.5126, 47.7794], [169.6197, 33.0943], [169.5468, 31.5308]],
      [[176.5126, 47.7794], [167.4159, 44.4985], [155.5823, 41.4995]],
      [[167.4159, 44.4985], [154.2741, 42.9144]],
      // Head of the bear
      [[165.932, 61.751], [142.8821, 63.0619], [127.5661, 60.7182],
       [147.7473, 59.0387], [165.4603, 56.3824]],
      [[165.4603, 56.3824], [148.0265, 54.0643], [143.2143, 51.6773], [134.8019, 48.0418]],
      [[135.9064, 47.1565], [143.2143, 51.6773]],
    ],
  },
  {
    id: "Cas", // Cassiopeia — the W shape
    lines: [
      [[28.5989, 63.6701], [21.454, 60.2353], [14.1772, 60.7167],
       [10.1268, 56.5373], [2.2945, 59.1498]],
    ],
  },
  {
    id: "Leo", // Leo
    lines: [
      // Sickle (head) + body
      [[152.093, 11.9672], [151.8331, 16.7627], [154.9931, 19.8415],
       [168.5271, 20.5237], [177.2649, 14.5721], [168.56, 15.4296], [152.093, 11.9672]],
      // Rump and back
      [[154.9931, 19.8415], [154.1726, 23.4173], [148.1909, 26.007], [146.4628, 23.7743]],
    ],
  },
  {
    id: "Sco", // Scorpius
    lines: [
      // Head claws
      [[-120.287, -26.1141], [-119.9166, -22.6217], [-118.6407, -19.8055]],
      // Main body and tail curl
      [[-119.9166, -22.6217], [-114.7028, -25.5928], [-112.6481, -26.432],
       [-111.0294, -28.216], [-107.4591, -34.2932], [-107.0324, -38.0474],
       [-106.3541, -42.3613], [-101.9617, -43.2392], [-95.6703, -42.9978],
       [-93.1038, -40.127], [-94.378, -39.03], [-96.5978, -37.1038]],
    ],
  },
  {
    id: "Cyg", // Cygnus — the Northern Cross
    lines: [
      // Long axis (neck to tail): Albireo → Deneb
      [[-41.7659, 30.2269], [-48.4472, 33.9703], [-54.4429, 40.2567],
       [-63.7563, 45.1308], [-67.5735, 51.7298], [-70.7243, 53.3685]],
      // Cross-bar (wing tips)
      [[-49.642, 45.2803], [-54.4429, 40.2567], [-60.9235, 35.0834], [-67.3197, 27.9597]],
    ],
  },
  {
    id: "Lyr", // Lyra
    lines: [
      // Parallelogram + Vega
      [[-78.8068, 37.6051], [-78.9051, 39.6127], [-80.7653, 38.7837],
       [-78.8068, 37.6051], [-76.3738, 36.8986], [-75.2641, 32.6896],
       [-77.48, 33.3627], [-78.8068, 37.6051]],
    ],
  },
  {
    id: "Aql", // Aquila
    lines: [
      // Main body: tail → Altair → head
      [[-63.4351, 10.6133], [-62.3042, 8.8683], [-61.1717, 6.4068],
       [-57.1738, -0.8215], [-61.8818, 1.0057], [-68.6254, 3.1148],
       [-73.6475, 13.8635], [-62.3042, 8.8683], [-68.6254, 3.1148], [-73.4378, -4.8826]],
    ],
  },
];

// ---------------------------------------------------------------------------
// HELPER: Convert d3-celestial RA [-180,180] to standard [0,360)
// ---------------------------------------------------------------------------

/**
 * d3-celestial stores RA in the range [-180, 180]. Standard astronomical
 * convention uses [0, 360). Call this on any RA value from CONSTELLATION_LINES
 * before passing to a star-projection function that expects [0, 360).
 */
export function normalizeRA(ra: number): number {
  return ra < 0 ? ra + 360 : ra;
}

/**
 * Convert RA in decimal degrees to hours (for display or alternative APIs).
 */
export function raDegreesToHours(raDeg: number): number {
  return normalizeRA(raDeg) / 15;
}
