const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const manifestPath = path.join(rootDir, "manifest.json");

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const manifestContent = fs.readFileSync(manifestPath, "utf8");
const versionMatch = manifestContent.match(/"version"\s*:\s*"([^"]+)"/);

if (!versionMatch) {
  throw new Error("Could not find version field in manifest.json");
}

const manifestVersion = versionMatch[1];

if (manifestVersion !== packageJson.version) {
  const updatedContent = manifestContent.replace(
    /"version"\s*:\s*"[^"]+"/,
    `"version": "${packageJson.version}"`
  );
  fs.writeFileSync(manifestPath, updatedContent);
  console.log(`Updated manifest.json version to ${packageJson.version}`);
} else {
  console.log(`manifest.json already matches version ${packageJson.version}`);
}
