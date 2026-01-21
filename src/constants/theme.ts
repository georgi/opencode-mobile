export const palette = {
  smoke: {
    1: "#0a0706",
    2: "#100c0c",
    3: "#191514",
    4: "#221e1d",
    5: "#2c2827",
    6: "#393433",
    7: "#4b4646",
    8: "#6d6867",
    9: "#7e7978",
    10: "#969190",
    11: "#c8c3c1",
    12: "#f6f0ef",
  },
  yuzu: {
    1: "#100906",
    2: "#190f09",
    3: "#26160c",
    4: "#341e10",
    5: "#472b18",
    6: "#5c3920",
    7: "#784c2f",
    8: "#9d6540",
    9: "#fab283",
    10: "#e9a274",
    11: "#dd9e74",
    12: "#ffddc1",
  },
  cobalt: {
    1: "#040a1c",
    2: "#051029",
    3: "#06173f",
    4: "#061e57",
    5: "#0b2a76",
    6: "#103796",
    7: "#1b4cbf",
    8: "#2765f7",
    9: "#034cff",
    10: "#0038ed",
    11: "#59a2ff",
    12: "#afe6ff",
  },
  apple: {
    1: "#030f03",
    2: "#041703",
    3: "#012200",
    4: "#002e00",
    5: "#004100",
    6: "#005400",
    7: "#006d00",
    8: "#009000",
    9: "#12c905",
    10: "#00b800",
    11: "#43ce3b",
    12: "#adffa5",
  },
  solaris: {
    1: "#0f0b02",
    2: "#161101",
    3: "#221a00",
    4: "#2f2300",
    5: "#413100",
    6: "#544000",
    7: "#6d5500",
    8: "#907100",
    9: "#fcd53a",
    10: "#ebc51d",
    11: "#cdab19",
    12: "#fee79a",
  },
  ember: {
    1: "#160604",
    2: "#210906",
    3: "#320c07",
    4: "#440e07",
    5: "#5d160c",
    6: "#771e11",
    7: "#992d1d",
    8: "#c73d29",
    9: "#fc533a",
    10: "#ea4129",
    11: "#ff785f",
    12: "#ffc8b4",
  },
  lilac: {
    1: "#0f090f",
    2: "#160e17",
    3: "#221523",
    4: "#2e1d30",
    5: "#402942",
    6: "#533655",
    7: "#6d496f",
    8: "#8f6192",
    9: "#edb2f1",
    10: "#dca2e0",
    11: "#cd99d0",
    12: "#fedaff",
  },
  mint: {
    1: "#080d07",
    2: "#0d140c",
    3: "#121e12",
    4: "#192918",
    5: "#243922",
    6: "#2f4a2e",
    7: "#41623f",
    8: "#578154",
    9: "#c8ffc4",
    10: "#b8eeb4",
    11: "#8ebc8a",
    12: "#d2f2cf",
  },
};

export const colors = {
  // Backgrounds
  background: {
    base: palette.smoke[1],
    baseHover: palette.smoke[2],
    weak: palette.smoke[2],
    strong: palette.smoke[3],
    stronger: palette.smoke[4],
  },

  // Surface
  surface: {
    base: palette.smoke[2],
    highlight: palette.smoke[3],
    strong: palette.smoke[4],
  },

  // Text
  text: {
    base: palette.smoke[11],
    weak: palette.smoke[9],
    weaker: palette.smoke[7],
    strong: palette.smoke[12],
    invert: palette.smoke[12], // Use white/light text for inverted surfaces (filled buttons/bubbles)
  },

  // Interactive
  interactive: {
    base: palette.smoke[8],
    hover: palette.smoke[9],
    active: palette.cobalt[12],
    text: palette.smoke[12],
  },

  // Status
  status: {
    success: palette.apple[9],
    warning: palette.solaris[9],
    error: palette.ember[9],
    info: palette.lilac[9],
  },

  // Diff
  diff: {
    add: palette.mint[11], // #8ebc8a (Muted, readable green)
    delete: palette.ember[11], // #ff785f (Muted, readable red)
    addBg: palette.mint[4], // #192918 (Subtle green background)
    deleteBg: palette.ember[4], // #440e07 (Subtle red background)
  },

  // Inputs
  input: {
    bg: palette.smoke[2],
    border: palette.smoke[4],
    focus: palette.cobalt[9],
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const fonts = {
  sans: "System",
  mono: "System", // Using system mono for now, could load IBM Plex Mono later
  size: {
    sm: 13,
    base: 14,
    lg: 16,
    xl: 20,
  },
  weight: {
    regular: "400",
    medium: "500",
    bold: "700",
  },
};
