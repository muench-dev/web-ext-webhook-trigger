module.exports = {
  verbose: false,
  ignoreFiles: [
    ".amo-upload-uuid",
    "package.json",
    "package-lock.json",
    "README.md",
    "jest.config.js",
    "web-ext-config.cjs",

    // directories to ignore
    "docs",
    "__tests__"
  ],
  build: {
    overwriteDest: true,
  },
};
