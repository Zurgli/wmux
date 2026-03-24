import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createDefaultConfig, loadConfig, saveConfig, getWmuxDir } from '../config';
import type { DaemonConfig } from '../types';

/** Use a temp directory instead of the real ~/.wmux */
let originalHomedir: typeof os.homedir;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wmux-config-test-'));
  originalHomedir = os.homedir;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (os as any).homedir = () => tmpDir;
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (os as any).homedir = originalHomedir;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('createDefaultConfig', () => {
  it('returns a valid DaemonConfig with expected defaults', () => {
    const config = createDefaultConfig();
    expect(config.version).toBe(1);
    expect(config.daemon.logLevel).toBe('info');
    expect(config.daemon.autoStart).toBe(true);
    expect(typeof config.daemon.pipeName).toBe('string');
    expect(config.session.defaultCols).toBe(120);
    expect(config.session.defaultRows).toBe(30);
    expect(config.session.bufferSizeMb).toBe(8);
    expect(config.session.bufferMaxMb).toBe(64);
    expect(config.session.deadSessionTtlHours).toBe(24);
    expect(config.session.deadSessionDumpBuffer).toBe(true);
    expect(typeof config.session.defaultShell).toBe('string');
  });
});

describe('loadConfig', () => {
  it('creates ~/.wmux directory and default config when nothing exists', () => {
    const wmuxDir = getWmuxDir();
    expect(fs.existsSync(wmuxDir)).toBe(false);

    const config = loadConfig();
    expect(fs.existsSync(wmuxDir)).toBe(true);
    expect(fs.existsSync(path.join(wmuxDir, 'config.json'))).toBe(true);
    expect(config.version).toBe(1);
  });

  it('loads an existing valid config from disk', () => {
    const wmuxDir = getWmuxDir();
    fs.mkdirSync(wmuxDir, { recursive: true });

    const custom: DaemonConfig = {
      ...createDefaultConfig(),
      daemon: {
        ...createDefaultConfig().daemon,
        logLevel: 'debug',
      },
    };
    fs.writeFileSync(
      path.join(wmuxDir, 'config.json'),
      JSON.stringify(custom, null, 2),
      'utf-8',
    );

    const loaded = loadConfig();
    expect(loaded.daemon.logLevel).toBe('debug');
  });

  it('resets to defaults when config.json contains invalid JSON', () => {
    const wmuxDir = getWmuxDir();
    fs.mkdirSync(wmuxDir, { recursive: true });
    fs.writeFileSync(path.join(wmuxDir, 'config.json'), '{{not json}}', 'utf-8');

    const config = loadConfig();
    expect(config.version).toBe(1);
    expect(config.daemon.logLevel).toBe('info');
  });

  it('resets to defaults when config.json has wrong structure', () => {
    const wmuxDir = getWmuxDir();
    fs.mkdirSync(wmuxDir, { recursive: true });
    fs.writeFileSync(
      path.join(wmuxDir, 'config.json'),
      JSON.stringify({ version: 1, daemon: 'wrong' }),
      'utf-8',
    );

    const config = loadConfig();
    expect(config.version).toBe(1);
    expect(config.daemon.logLevel).toBe('info');
  });
});

describe('saveConfig', () => {
  it('writes config atomically (no .tmp residue)', () => {
    const wmuxDir = getWmuxDir();
    fs.mkdirSync(wmuxDir, { recursive: true });

    const config = createDefaultConfig();
    saveConfig(config);

    const configPath = path.join(wmuxDir, 'config.json');
    const tmpPath = configPath + '.tmp';
    expect(fs.existsSync(configPath)).toBe(true);
    expect(fs.existsSync(tmpPath)).toBe(false);

    const loaded = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    expect(loaded.version).toBe(1);
  });
});
