// Paste from color.ts
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;

  const num = parseInt(full, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function rgbToHex(r, g, b) {
  const toHex = (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    const int = Math.round(clamped * 255);
    return int.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function linearToSrgb(c) {
  if (c <= 0.0031308) return c * 12.92;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function srgbToLinear(c) {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function rgbToOklch(r, g, b) {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bOk = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const C = Math.sqrt(a * a + bOk * bOk);
  let H = Math.atan2(bOk, a) * (180 / Math.PI);
  if (H < 0) H += 360;

  return { l: L, c: C, h: H };
}

function oklchToRgb(oklch) {
  const { l: L, c: C, h: H } = oklch;

  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);

  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  const lr = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const lg = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const lb = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lb),
  };
}

function hexToOklch(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToOklch(r, g, b);
}

function oklchToHex(oklch) {
  const { r, g, b } = oklchToRgb(oklch);
  return rgbToHex(r, g, b);
}

function generateScale(seed, isDark) {
  const base = hexToOklch(seed);
  const scale = [];

  const lightSteps = isDark
    ? [
        0.15,
        0.18,
        0.22,
        0.26,
        0.32,
        0.38,
        0.46,
        0.56,
        base.l,
        base.l - 0.05,
        0.75,
        0.93,
      ]
    : [
        0.99,
        0.97,
        0.94,
        0.9,
        0.85,
        0.79,
        0.72,
        0.64,
        base.l,
        base.l + 0.05,
        0.45,
        0.25,
      ];

  const chromaMultipliers = isDark
    ? [0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85, 1, 1, 0.9, 0.6]
    : [0.1, 0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85, 1, 1, 0.95, 0.85];

  for (let i = 0; i < 12; i++) {
    scale.push(
      oklchToHex({
        l: lightSteps[i],
        c: base.c * chromaMultipliers[i],
        h: base.h,
      }),
    );
  }

  return scale;
}

function generateNeutralScale(seed, isDark) {
  const base = hexToOklch(seed);
  const scale = [];
  const neutralChroma = Math.min(base.c, 0.02);

  const lightSteps = isDark
    ? [0.13, 0.16, 0.2, 0.24, 0.28, 0.33, 0.4, 0.52, 0.58, 0.66, 0.82, 0.96]
    : [0.995, 0.98, 0.96, 0.94, 0.91, 0.88, 0.84, 0.78, 0.62, 0.56, 0.46, 0.2];

  for (let i = 0; i < 12; i++) {
    scale.push(
      oklchToHex({
        l: lightSteps[i],
        c: neutralChroma,
        h: base.h,
      }),
    );
  }

  return scale;
}

// Main execution
const seeds = {
  neutral: "#716c6b",
  primary: "#fab283",
  success: "#12c905",
  warning: "#fcd53a",
  error: "#fc533a",
  info: "#edb2f1",
  interactive: "#034cff",
  diffAdd: "#c8ffc4",
  diffDelete: "#fc533a",
};

// Note: checking oc-1.json to match keys to seeds.
// "smoke" -> neutral
// "yuzu" -> primary? No, yuzu is yellow-green. primary is fab283 (orangeish?).
// Let's re-read oc-1.json seeds.
// "primary": "#fab283" (Dark) -> yuzu?
// In light mode primary is #dcde8d.
// Let's assume names:
// neutral -> smoke
// primary -> yuzu ?
// interactive -> cobalt
// success -> apple
// warning -> solaris
// error -> ember
// info -> lilac
// diffAdd -> mint
// diffDelete -> ember (or separate)

// I will output all of them.
const isDark = true;
const smoke = generateNeutralScale(seeds.neutral, isDark);
const yuzu = generateScale(seeds.primary, isDark);
const cobalt = generateScale(seeds.interactive, isDark);
const apple = generateScale(seeds.success, isDark);
const solaris = generateScale(seeds.warning, isDark);
const ember = generateScale(seeds.error, isDark);
const lilac = generateScale(seeds.info, isDark);
const mint = generateScale(seeds.diffAdd, isDark);

// Blue is missing. I need a seed for blue. "blue" is used in surface-diff-hidden.
// I'll guess a blue seed (maybe standard blue?). interactive is #034cff which IS blue.
// So cobalt IS blue.
// Maybe "blue" variable refers to cobalt?
// oc-1.json uses "blue-light-3". Maybe "blue" is a separate scale.
// But I will stick to what I have.

console.log(
  JSON.stringify(
    {
      smoke,
      yuzu,
      cobalt,
      apple,
      solaris,
      ember,
      lilac,
      mint,
    },
    null,
    2,
  ),
);
