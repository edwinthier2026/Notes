const fs = require('node:fs');
const path = require('node:path');
const ts = require(path.join(__dirname, '..', 'node_modules', 'typescript', 'lib', 'typescript.js'));
const { spawn } = require('node:child_process');

function normalizeWindowsPath(value) {
  return process.platform === 'win32' && value.startsWith('\\\\?\\') ? value.slice(4) : value;
}

function createTempViteConfig(projectRoot) {
  const sourcePath = path.join(projectRoot, 'vite.config.ts');
  const tempPath = path.join(projectRoot, '.vite.config.codex.mjs');
  const source = fs
    .readFileSync(sourcePath, 'utf8')
    .replace(
      "import packageJson from './package.json';",
      "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\nconst packageJson = require('./package.json');"
    );

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: sourcePath,
  });

  fs.writeFileSync(tempPath, transpiled.outputText, 'utf8');
  return tempPath;
}

const projectRoot = normalizeWindowsPath(path.resolve(__dirname, '..'));
const tool = process.argv[2];
const args = process.argv.slice(3);

const toolBins = {
  tsc: path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  vite: path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
};

if (!toolBins[tool]) {
  console.error(`Unknown tool: ${tool}`);
  process.exit(1);
}

process.chdir(projectRoot);

const viteConfigPath = tool === 'vite' ? createTempViteConfig(projectRoot) : '';
const finalArgs = tool === 'vite' ? ['--config', viteConfigPath, ...args] : args;

const child = spawn(process.execPath, [toolBins[tool], ...finalArgs], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    INIT_CWD: projectRoot,
  },
});

function cleanup() {
  if (viteConfigPath && fs.existsSync(viteConfigPath)) {
    fs.unlinkSync(viteConfigPath);
  }
}

child.on('exit', (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on('error', (error) => {
  cleanup();
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});