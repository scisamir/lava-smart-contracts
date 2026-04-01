const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(appRoot, ".next", "server", "vendor-chunks");
const targetDir = path.join(
  appRoot,
  ".next",
  "server",
  "chunks",
  "vendor-chunks",
);

if (!fs.existsSync(sourceDir)) {
  process.exit(0);
}

fs.mkdirSync(path.dirname(targetDir), { recursive: true });
fs.rmSync(targetDir, { recursive: true, force: true });
fs.cpSync(sourceDir, targetDir, { recursive: true });
