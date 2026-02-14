// scripts/process-mrpacks.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

function calculateSHA1(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha1");
  hashSum.update(fileBuffer);

  return hashSum.digest("hex");
}

function findMrpackFilesManual() {
  const modpacksDir = path.join(process.cwd(), "modpacks");
  const mrpackFiles = [];

  const scanDirectory = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        scanDirectory(fullPath);

        continue;
      }

      if (
        entry.isFile() &&
        entry.name.endsWith(".mrpack") &&
        entry.name !== "instance.mrpack"
      ) {
        mrpackFiles.push(fullPath);
      }
    }
  };

  if (fs.existsSync(modpacksDir)) {
    scanDirectory(modpacksDir);
  }

  return mrpackFiles;
}
function findMrpackFiles() {
  try {
    const before = process.env.GITHUB_EVENT_BEFORE || "HEAD~1";
    const after = process.env.GITHUB_SHA || "HEAD";

    const output = execSync(
      `git diff --name-only --diff-filter=AM ${before} ${after}`,
      { encoding: "utf-8" },
    );

    return output
      .split("\n")
      .filter((file) => file.endsWith(".mrpack") && file.includes("modpacks/"))
      .map((file) => path.join(process.cwd(), file))
      .filter((file) => fs.existsSync(file));
  } catch (error) {
    console.error("Error getting changed files from git:", error.message);
    return [];
  }
}

function processMrpackFile(filePath) {
  console.log(`Processing: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.log(`Skipping deleted file: ${filePath}`);
    return;
  }

  const dir = path.dirname(filePath);
  const instanceName = path.basename(dir);
  const targetPath = path.join(dir, "instance.mrpack");

  try {
    const sha1 = calculateSHA1(filePath);

    execSync(`unzip -o -j "${filePath}" "modrinth.index.json" -d "${dir}"`, {
      stdio: "pipe",
    });

    const modrinthPath = path.join(dir, "modrinth.index.json");
    if (fs.existsSync(modrinthPath)) {
      const modrinthData = JSON.parse(fs.readFileSync(modrinthPath, "utf-8"));
      modrinthData.sha1 = sha1;
      modrinthData.id = instanceName;

      fs.writeFileSync(modrinthPath, JSON.stringify(modrinthData, null, 2));
      fs.chmodSync(modrinthPath, 0o644);
    }

    execSync(`unzip -o -j "${filePath}" "overrides/icon.png" -d "${dir}"`, {
      stdio: "pipe",
    });

    const iconPath = path.join(dir, "icon.png");
    if (fs.existsSync(iconPath)) {
      fs.chmodSync(iconPath, 0o644);
    }

    if (filePath !== targetPath) {
      fs.renameSync(filePath, targetPath);
    }

    console.log(`✓ Successfully processed ${instanceName}`);
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    throw error;
  }
}
function main() {
  const isManualTrigger =
    process.env.GITHUB_EVENT_NAME === "workflow_dispatch" ||
    process.argv.includes("--manual");

  const mrpackFiles = isManualTrigger
    ? findMrpackFilesManual()
    : findMrpackFiles();

  if (mrpackFiles.length === 0) {
    return;
  }

  for (const file of mrpackFiles) {
    try {
      processMrpackFile(file);
    } catch (error) {
      process.exit(1);
    }
  }
}

main();
