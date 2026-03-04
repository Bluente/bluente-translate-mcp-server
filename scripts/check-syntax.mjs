import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const roots = ["src", "tests"];

async function collectJsFiles(root) {
  const files = [];

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && /\.(mjs|cjs|js)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}

function runNodeCheck(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function main() {
  const allFiles = [];
  for (const root of roots) {
    const files = await collectJsFiles(root);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log("No JavaScript files found under src/ or tests/.");
    return;
  }

  for (const file of allFiles) {
    const code = await runNodeCheck(file);
    if (code !== 0) {
      process.exit(code);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
