import { type SpawnOptions, type SpawnSyncOptions, spawn, spawnSync } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export function isMainModule(importMetaUrl: string): boolean {
  const entry = process.argv[1];
  return entry ? pathToFileURL(resolve(entry)).href === importMetaUrl : false;
}

export function nowNs(): bigint {
  return process.hrtime.bigint();
}

export function elapsedNs(start: bigint): number {
  return Number(process.hrtime.bigint() - start);
}

export async function listFilesRecursive(root: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      files.push(relative(root, fullPath).split(sep).join('/'));
    }
  }

  await walk(root);
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

export function resolveLocalBin(name: string): string {
  const binName = process.platform === 'win32' ? `${name}.cmd` : name;
  return resolve('node_modules', '.bin', binName);
}

interface RunLocalBinOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  quiet?: boolean;
}

export async function runLocalBin(
  name: string,
  args: string[],
  options: RunLocalBinOptions = {}
): Promise<string> {
  const { cwd, env, quiet = false } = options;

  return await new Promise((resolvePromise, reject) => {
    const child = spawn(resolveLocalBin(name), args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit'
    });

    let stdout = '';
    let stderr = '';

    if (quiet) {
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', chunk => {
        stdout += chunk;
      });
      child.stderr?.on('data', chunk => {
        stderr += chunk;
      });
    }

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolvePromise(stdout);
        return;
      }
      reject(
        new Error(
          quiet && stderr.trim().length > 0
            ? stderr.trim()
            : `${name} ${args.join(' ')} exited with code ${code ?? 'unknown'}`
        )
      );
    });
  });
}

export function runNodeScriptSync(
  script: string,
  options: SpawnSyncOptions = {}
): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], options);
}

export function spawnNodeProcess(
  args: string[],
  options: SpawnOptions = {}
): ReturnType<typeof spawn> {
  return spawn(process.execPath, args, options);
}
