module.exports = {
  verbose: false,
  ignoreFiles: [
    "AGENTS.md",
    ".amo-upload-uuid",
    "package.json",
    "package-lock.json",
    "README.md",
    "jest.config.js",
    "web-ext-config.cjs",

    // directories to ignore
    "docs",
    "tests"
  ],
  build: {
    overwriteDest: true,
  },
};
