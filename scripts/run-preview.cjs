const path = require('node:path');
const { loadViteConfig, normalizeWindowsPath, patchWindowsNetUseExec } = require('./load-vite-config.cjs');

function readArgValue(flag, fallback = '') {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index < process.argv.length - 1 ? process.argv[index + 1] : fallback;
}

(async () => {
  const projectRoot = normalizeWindowsPath(path.resolve(__dirname, '..'));
  process.chdir(projectRoot);

  patchWindowsNetUseExec();
  const { preview } = await import(pathToFileURL(path.join(projectRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const config = await loadViteConfig({ mode: 'production', command: 'serve' });
  const port = Number(readArgValue('--port', process.env.PORT || '8080')) || 8080;
  const host = readArgValue('--host', process.env.HOST || '') || true;

  const server = await preview({
    ...config,
    configFile: false,
    preview: {
      ...(config.preview || {}),
      port,
      host,
    },
  });

  const close = async () => {
    await server.httpServer?.close();
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);
})().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});

function pathToFileURL(filePath) {
  return require('node:url').pathToFileURL(filePath);
}
