import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory (since __dirname is not available in ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function removePath(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
    console.log(`🗑️ Removed: ${targetPath}`);
  }
}

function cleanProject(projectPath) {
  console.log(`\n🧹 Cleaning project at: ${projectPath}`);

  removePath(path.join(projectPath, "node_modules"));
  removePath(path.join(projectPath, "package-lock.json"));
}

try {
  // Clean root
  cleanProject(__dirname);

  // Clean server
  cleanProject(path.join(__dirname, "server"));

  // Clear npm cache
  console.log("\n🧽 Clearing npm cache...");
  execSync("npm cache clean --force", { stdio: "inherit" });

  // Install root dependencies
  console.log("\n📦 Installing root dependencies...");
  execSync("npm install", { stdio: "inherit" });

  // Install server dependencies
  console.log("\n📦 Installing server dependencies...");
  execSync("cd server && npm install", { stdio: "inherit" });

  console.log("\n✅ Cleanup and reinstallation complete!");
} catch (err) {
  console.error("❌ Error during cleanup:", err.message);
}
