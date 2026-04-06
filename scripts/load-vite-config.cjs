const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');
const childProcess = require('node:child_process');
const ts = require(path.join(__dirname, '..', 'node_modules', 'typescript', 'lib', 'typescript.js'));

let windowsExecPatched = false;
let windowsSpawnPatched = false;

function normalizeWindowsPath(value) {
  return process.platform === 'win32' && value.startsWith('\\\\?\\') ? value.slice(4) : value;
}

function patchWindowsNetUseExec(projectRoot = '') {
  if (process.platform !== 'win32') {
    return;
  }

  const normalizedRoot = projectRoot || normalizeWindowsPath(path.resolve(__dirname, '..'));

  if (!windowsExecPatched) {
    const originalExec = childProcess.exec;
    childProcess.exec = function patchedExec(command, options, callback) {
      const normalizedCommand = String(command || '').trim().toLowerCase();
      const cb = typeof options === 'function' ? options : callback;

      if (normalizedCommand === 'net use') {
        const child = new EventEmitter();
        child.stdout = new EventEmitter();
        child.stderr = new EventEmitter();
        child.pid = 0;
        child.kill = () => true;
        child.ref = () => child;
        child.unref = () => child;
        process.nextTick(() => {
          if (typeof cb === 'function') {
            cb(null, '', '');
          }
          child.emit('close', 0);
          child.emit('exit', 0);
        });
        return child;
      }

      return originalExec.call(this, command, options, callback);
    };
    windowsExecPatched = true;
  }

  if (!windowsSpawnPatched) {
    const originalSpawn = childProcess.spawn;
    childProcess.spawn = function patchedSpawn(command, args, options) {
      const commandText = String(command || '').toLowerCase();
      const isEsbuild = commandText.endsWith('esbuild.exe');
      if (isEsbuild) {
        return originalSpawn.call(this, command, args, { ...(options || {}), cwd: normalizedRoot });
      }
      return originalSpawn.call(this, command, args, options);
    };
    windowsSpawnPatched = true;
  }
}

async function loadViteConfig({ mode, command }) {
  const projectRoot = normalizeWindowsPath(path.resolve(__dirname, '..'));
  const sourcePath = path.join(projectRoot, 'vite.config.ts');
  const tempPath = path.join(projectRoot, `.vite.config.codex.${command}.${Date.now()}.mjs`);
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

  try {
    const imported = await import(`${pathToFileURL(tempPath).href}?t=${Date.now()}`);
    const exported = imported.default;
    return typeof exported === 'function'
      ? await exported({ mode, command, isSsrBuild: false, isPreview: command === 'serve' })
      : exported;
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

module.exports = {
  loadViteConfig,
  normalizeWindowsPath,
  patchWindowsNetUseExec,
};