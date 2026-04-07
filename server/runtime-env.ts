import fs from 'node:fs';
import path from 'node:path';

type RuntimeEnvMap = Record<string, string>;

function parseEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1);
    return trimmed.startsWith('"')
      ? inner
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
      : inner;
  }

  const commentIndex = trimmed.indexOf(' #');
  return commentIndex >= 0 ? trimmed.slice(0, commentIndex).trim() : trimmed;
}

function parseEnvFile(content: string): RuntimeEnvMap {
  const result: RuntimeEnvMap = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    result[key] = parseEnvValue(normalized.slice(separatorIndex + 1));
  }

  return result;
}

function readEnvFile(filePath: string): RuntimeEnvMap {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return parseEnvFile(fs.readFileSync(filePath, 'utf8'));
}

export function getRuntimeEnv(mode: string, rootDir = process.cwd()): RuntimeEnvMap {
  const files = ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`];
  const fileEnv = files.reduce<RuntimeEnvMap>((accumulator, fileName) => {
    return {
      ...accumulator,
      ...readEnvFile(path.join(rootDir, fileName)),
    };
  }, {});

  const processEnv = Object.entries(process.env).reduce<RuntimeEnvMap>((accumulator, [key, value]) => {
    if (typeof value === 'string') {
      accumulator[key] = value;
    }
    return accumulator;
  }, {});

  return {
    ...fileEnv,
    ...processEnv,
  };
}
