const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { glob } = require("glob");

async function generateIndex() {
  const serversDir = path.join(process.cwd(), "servers");
  const index = {};

  const files = await glob("servers/**/*.md");

  files.forEach((file) => {
    const { data } = matter.read(file);

    const relativePath = path.relative(serversDir, file);
    const parsed = path.parse(relativePath);

    const parts = parsed.dir.split(path.sep);
    const lang = parts[0];
    const filename = parsed.name;

    if (!index[filename]) {
      index[filename] = {};
    }
    index[filename][lang] = data;
  });

  const outputPath = path.join(serversDir, "index.json");
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));
}

generateIndex().catch(console.error);
