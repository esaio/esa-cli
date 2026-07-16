export const config = {
  cli: {
    name: "esa",
    description: "Official CLI for esa.io",
    version: "0.0.1",
  },
  esa: {
    apiAccessToken: process.env.ESA_ACCESS_TOKEN || "",
    apiBaseUrl: process.env.ESA_API_BASE_URL || "https://api.esa.io",
  },
} as const;
