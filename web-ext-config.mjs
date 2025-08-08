export default {
  verbose: false,
  ignoreFiles: [
    "AGENTS.md",
    ".amo-upload-uuid",
    "package.json",
    "package-lock.json",
    "README.md",
    "jest.config.js",
    "web-ext-config.mjs",

    // directories to ignore
    "docs",
    "tests"
  ],
  build: {
    overwriteDest: true,
  },
};
