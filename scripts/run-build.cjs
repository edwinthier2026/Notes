const path = require('node:path');
const { loadViteConfig, normalizeWindowsPath, patchWindowsNetUseExec } = require('./load-vite-config.cjs');

(async () => {
  const projectRoot = normalizeWindowsPath(path.resolve(__dirname, '..'));
  process.chdir(projectRoot);

  const tsBin = path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  const { spawnSync } = require('node:child_process');
  const tscResult = spawnSync(process.execPath, [tsBin], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env, INIT_CWD: projectRoot },
  });

  if (tscResult.status !== 0) {
    process.exit(tscResult.status || 1);
  }

  patchWindowsNetUseExec();
  const { build } = await import(pathToFileURL(path.join(projectRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const config = await loadViteConfig({ mode: 'production', command: 'build' });
  await build({ ...config, configFile: false });
})().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

function pathToFileURL(filePath) {
  return require('node:url').pathToFileURL(filePath);
}