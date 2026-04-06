const major = Number(process.versions.node.split(".")[0]);
const minMajor = 20;
const maxMajorExclusive = 24;

if (Number.isNaN(major) || major < minMajor || major >= maxMajorExclusive) {
  const current = process.versions.node;
  console.error("");
  console.error("Unsupported Node.js version detected.");
  console.error(`Current: v${current}`);
  console.error(`Required: >=${minMajor} and <${maxMajorExclusive} (recommended: Node 22 LTS)`);
  console.error("");
  console.error("Fix:");
  console.error("1. Switch to Node 22 LTS");
  console.error("2. Remove node_modules and package-lock.json");
  console.error("3. Run: npm install");
  console.error("4. Run: npm run dev");
  console.error("");
  process.exit(1);
}
