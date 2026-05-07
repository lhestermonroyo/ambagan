export const getSuccessHex = (
  className: keyof (typeof successColorMap)["light" | "dark"],
  colorScheme: "light" | "dark" = "light"
) => {
  return successColorMap[colorScheme][className] || className;
};

export const getErrorHex = (
  className: keyof (typeof errorColorMap)["light" | "dark"],
  colorScheme: "light" | "dark" = "light"
) => {
  return errorColorMap[colorScheme][className] || className;
};

export const getPrimaryHex = (
  className: keyof (typeof primaryColorMap)["light" | "dark"],
  colorScheme: "light" | "dark" = "light"
) => {
  return primaryColorMap[colorScheme][className] || className;
};

export const getSecondaryHex = (
  className: keyof (typeof secondaryColorMap)["light" | "dark"],
  colorScheme: "light" | "dark" = "light"
) => {
  return secondaryColorMap[colorScheme][className] || className;
};

const primaryColorMap = {
  light: {
    "text-primary-0": "#F5F3FF",
    "text-primary-50": "#EDE9FE",
    "text-primary-100": "#DDD6FE",
    "text-primary-200": "#C4B5FD",
    "text-primary-300": "#A78BFA",
    "text-primary-400": "#8B5CF6",
    "text-primary-500": "#7C3AED",
    "text-primary-600": "#6D28D9",
    "text-primary-700": "#5B21B6",
    "text-primary-800": "#4C1D95",
    "text-primary-900": "#2E1065",
    "text-primary-950": "#14052E"
  },
  dark: {
    "text-primary-0": "#14052E",
    "text-primary-50": "#2E1065",
    "text-primary-100": "#4C1D95",
    "text-primary-200": "#5B21B6",
    "text-primary-300": "#6D28D9",
    "text-primary-400": "#7C3AED",
    "text-primary-500": "#8B5CF6",
    "text-primary-600": "#A78BFA",
    "text-primary-700": "#C4B5FD",
    "text-primary-800": "#DDD6FE",
    "text-primary-900": "#EDE9FE",
    "text-primary-950": "#F5F3FF"
  }
};

const secondaryColorMap = {
  light: {
    "text-secondary-0": "#FDFDFD",
    "text-secondary-50": "#FBFBFB",
    "text-secondary-100": "#F6F6F6",
    "text-secondary-200": "#F2F2F2",
    "text-secondary-300": "#EDEDED",
    "text-secondary-400": "#E6E6E7",
    "text-secondary-500": "#D9D9DB",
    "text-secondary-600": "#C6C7C7",
    "text-secondary-700": "#BDBDBD",
    "text-secondary-800": "#B1B1B1",
    "text-secondary-900": "#A5A4A4",
    "text-secondary-950": "#9D9D9D"
  },
  dark: {
    "text-secondary-0": "#141414",
    "text-secondary-50": "#171717",
    "text-secondary-100": "#1F1F1F",
    "text-secondary-200": "#272727",
    "text-secondary-300": "#2C2C2C",
    "text-secondary-400": "#383939",
    "text-secondary-500": "#3F4040",
    "text-secondary-600": "#565656",
    "text-secondary-700": "#6E6E6E",
    "text-secondary-800": "#878787",
    "text-secondary-900": "#969696",
    "text-secondary-950": "#A4A4A4"
  }
};

const successColorMap = {
  light: {
    "text-success-0": "#E4FFF4",
    "text-success-50": "#CAFFE8",
    "text-success-100": "#A2F1C0",
    "text-success-200": "#84D3A2",
    "text-success-300": "#66B584",
    "text-success-400": "#489766",
    "text-success-500": "#348352",
    "text-success-600": "#2A7948",
    "text-success-700": "#206F3E",
    "text-success-800": "#166534",
    "text-success-900": "#14532D",
    "text-success-950": "#1B3224"
  },
  dark: {
    "text-success-0": "#1B3224",
    "text-success-50": "#14532D",
    "text-success-100": "#166534",
    "text-success-200": "#206F3E",
    "text-success-300": "#2A7948",
    "text-success-400": "#348352",
    "text-success-500": "#489766",
    "text-success-600": "#66B584",
    "text-success-700": "#84D3A2",
    "text-success-800": "#A2F1C0",
    "text-success-900": "#CAFFE8",
    "text-success-950": "#E4FFF4"
  }
};

const errorColorMap = {
  light: {
    "text-error-0": "#FEE9E9",
    "text-error-50": "#FEE2E2",
    "text-error-100": "#FECACA",
    "text-error-200": "#FCA5A5",
    "text-error-300": "#F87171",
    "text-error-400": "#EF4444",
    "text-error-500": "#E63535",
    "text-error-600": "#DC2626",
    "text-error-700": "#B91C1C",
    "text-error-800": "#991B1B",
    "text-error-900": "#7F1D1D",
    "text-error-950": "#531313"
  },
  dark: {
    "text-error-0": "#531313",
    "text-error-50": "#7F1D1D",
    "text-error-100": "#991B1B",
    "text-error-200": "#B91C1C",
    "text-error-300": "#DC2626",
    "text-error-400": "#E63535",
    "text-error-500": "#EF4444",
    "text-error-600": "#F96160",
    "text-error-700": "#E55B5A",
    "text-error-800": "#FECACA",
    "text-error-900": "#FEE2E2",
    "text-error-950": "#FEE9E9"
  }
};