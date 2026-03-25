import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// --- Mock node-pty -----------------------------------------------------------

class MockPty extends EventEmitter {
  pid = 12345;
  private _cols: number;
  private _rows: number;
  private dataCallbacks: ((data: string) => void)[] = [];
  private exitCallbacks: ((e: { exitCode: number; signal?: number }) => void)[] = [];
  killed = false;

  constructor(_cmd: string, _args: string[], opts: { cols: number; rows: number }) {
    super();
    this._cols = opts.cols;
    this._rows = opts.rows;
  }

  onData(cb: (data: string) => void) {
    this.dataCallbacks.push(cb);
    return { dispose: () => { /* noop */ } };
  }

  onExit(cb: (e: { exitCode: number; signal?: number }) => void) {
    this.exitCallbacks.push(cb);
    return { dispose: () => { /* noop */ } };
  }

  write(_data: string): void { /* noop */ }

  resize(cols: number, rows: number): void {
    this._cols = cols;
    this._rows = rows;
  }

  kill(): void {
    this.killed = true;
  }

  // Test helpers
  simulateData(data: string): void {
    for (const cb of this.dataCallbacks) cb(data);
  }

  simulateExit(exitCode: number): void {
    for (const cb of this.exitCallbacks) cb({ exitCode });
  }

  get cols() { return this._cols; }
  get rows() { return this._rows; }
}

let lastMockPty: MockPty | null = null;

vi.mock('node-pty', () => ({
  default: {
    spawn: (cmd: string, args: string[], opts: Record<string, unknown>) => {
      const mock = new MockPty(cmd, args as string[], opts as { cols: number; rows: number });
      lastMockPty = mock;
      return mock;
    },
  },
  spawn: (cmd: string, args: string[], opts: Record<string, unknown>) => {
    const mock = new MockPty(cmd, args as string[], opts as { cols: number; rows: number });
    lastMockPty = mock;
    return mock;
  },
}));

// Import after mock is set up
import { DaemonSessionManager } from '../DaemonSessionManager';

describe('DaemonSessionManager', () => {
  let manager: DaemonSessionManager;

  beforeEach(() => {
    manager = new DaemonSessionManager();
    lastMockPty = null;
  });

  afterEach(() => {
    manager.disposeAll();
  });

  // 1. createSession → session created with state = detached
  it('creates a session in detached state', () => {
    const session = manager.createSession({
      id: 'test-1',
      cmd: 'cmd.exe',
      cwd: 'C:\\Users',
    });

    expect(session).toBeDefined();
    expect(session.id).toBe('test-1');
    expect(session.state).toBe('detached');
    expect(session.cmd).toContain('cmd.exe');
    expect(session.cwd).toBe('C:\\Users');
    expect(session.cols).toBe(80);
    expect(session.rows).toBe(24);
    expect(session.pid).toBe(12345);
    expect(session.createdAt).toBeTruthy();
  });

  it('emits session:created event', () => {
    const handler = vi.fn();
    manager.on('session:created', handler);

    manager.createSession({ id: 'test-ev', cmd: 'cmd.exe', cwd: '.' });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].session.id).toBe('test-ev');
  });

  it('throws when creating a session with duplicate id', () => {
    manager.createSession({ id: 'dup', cmd: 'cmd.exe', cwd: '.' });
    expect(() => manager.createSession({ id: 'dup', cmd: 'cmd.exe', cwd: '.' }))
      .toThrow("Session 'dup' already exists");
  });

  // 2. listSessions → returns created sessions
  it('returns all sessions via listSessions', () => {
    manager.createSession({ id: 's1', cmd: 'cmd.exe', cwd: '.' });
    manager.createSession({ id: 's2', cmd: 'cmd.exe', cwd: '.' });

    const sessions = manager.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.id).sort()).toEqual(['s1', 's2']);
  });

  // 3. attachSession → state changes to attached
  it('changes state to attached via attachSession', () => {
    manager.createSession({ id: 'att', cmd: 'cmd.exe', cwd: '.' });
    const stateHandler = vi.fn();
    manager.on('session:stateChanged', stateHandler);

    manager.attachSession('att');

    expect(stateHandler).toHaveBeenCalledWith({ id: 'att', state: 'attached' });
    const sessions = manager.listSessions();
    expect(sessions[0].state).toBe('attached');
  });

  it('throws when attaching non-existent session', () => {
    expect(() => manager.attachSession('nope')).toThrow("Session 'nope' not found");
  });

  // 4. detachSession → state changes to detached
  it('changes state to detached via detachSession', () => {
    manager.createSession({ id: 'det', cmd: 'cmd.exe', cwd: '.' });
    manager.attachSession('det');

    const stateHandler = vi.fn();
    manager.on('session:stateChanged', stateHandler);

    manager.detachSession('det');

    expect(stateHandler).toHaveBeenCalledWith({ id: 'det', state: 'detached' });
    const sessions = manager.listSessions();
    expect(sessions[0].state).toBe('detached');
  });

  // 5. destroySession → session removed
  it('destroys a session and removes it from the list', () => {
    manager.createSession({ id: 'kill', cmd: 'cmd.exe', cwd: '.' });
    const destroyHandler = vi.fn();
    manager.on('session:destroyed', destroyHandler);

    manager.destroySession('kill');

    expect(destroyHandler).toHaveBeenCalledWith({ id: 'kill' });
    expect(manager.listSessions()).toHaveLength(0);
    expect(manager.getSession('kill')).toBeUndefined();
  });

  it('destroySession on non-existent id is a no-op', () => {
    expect(() => manager.destroySession('ghost')).not.toThrow();
  });

  // 6. disposeAll → all sessions destroyed
  it('disposes all sessions', () => {
    manager.createSession({ id: 'a', cmd: 'cmd.exe', cwd: '.' });
    manager.createSession({ id: 'b', cmd: 'cmd.exe', cwd: '.' });
    manager.createSession({ id: 'c', cmd: 'cmd.exe', cwd: '.' });

    const destroyHandler = vi.fn();
    manager.on('session:destroyed', destroyHandler);

    manager.disposeAll();

    expect(manager.listSessions()).toHaveLength(0);
    expect(destroyHandler).toHaveBeenCalledTimes(3);
  });

  // resizeSession
  it('resizes a session', () => {
    manager.createSession({ id: 'rsz', cmd: 'cmd.exe', cwd: '.', cols: 80, rows: 24 });
    manager.resizeSession('rsz', 120, 40);

    const session = manager.getSession('rsz');
    expect(session?.meta.cols).toBe(120);
    expect(session?.meta.rows).toBe(40);
  });

  it('throws when resizing non-existent session', () => {
    expect(() => manager.resizeSession('nope', 80, 24)).toThrow("Session 'nope' not found");
  });

  // getSession
  it('returns managed session by id', () => {
    manager.createSession({ id: 'get-me', cmd: 'cmd.exe', cwd: '.' });
    const managed = manager.getSession('get-me');
    expect(managed).toBeDefined();
    expect(managed?.meta.id).toBe('get-me');
    expect(managed?.ringBuffer).toBeDefined();
    expect(managed?.bridge).toBeDefined();
  });

  // PTY exit → session:died
  it('emits session:died when PTY process exits', () => {
    manager.createSession({ id: 'die', cmd: 'cmd.exe', cwd: '.' });
    const diedHandler = vi.fn();
    manager.on('session:died', diedHandler);

    // Simulate exit on the mock PTY
    lastMockPty?.simulateExit(1);

    expect(diedHandler).toHaveBeenCalledWith({ id: 'die', exitCode: 1 });
    const session = manager.getSession('die');
    expect(session?.meta.state).toBe('dead');
  });

  // Dead session cannot be attached/detached
  it('throws when attaching or detaching a dead session', () => {
    manager.createSession({ id: 'dead', cmd: 'cmd.exe', cwd: '.' });
    lastMockPty?.simulateExit(0);

    expect(() => manager.attachSession('dead')).toThrow("Session 'dead' is dead");
    expect(() => manager.detachSession('dead')).toThrow("Session 'dead' is dead");
  });

  // PTY data → ring buffer
  it('writes PTY data to the ring buffer', () => {
    manager.createSession({ id: 'buf', cmd: 'cmd.exe', cwd: '.' });
    const managed = manager.getSession('buf');

    lastMockPty?.simulateData('hello world');

    const stored = managed?.ringBuffer.readAll().toString();
    expect(stored).toBe('hello world');
  });

  // Agent metadata on session
  it('stores agent metadata when provided', () => {
    const session = manager.createSession({
      id: 'agent-s',
      cmd: 'cmd.exe',
      cwd: '.',
      agent: { role: 'coder', teamId: 'team-1', displayName: 'Claude' },
    });

    expect(session.agent).toEqual({ role: 'coder', teamId: 'team-1', displayName: 'Claude' });
  });

  // Session recovery: scrollbackData pre-fills ring buffer
  it('pre-fills ring buffer with scrollbackData when provided', () => {
    const scrollback = Buffer.from('previous terminal output\r\n$ ls\r\nfile.txt');
    const session = manager.createSession({
      id: 'recover-1',
      cmd: 'cmd.exe',
      cwd: '.',
      scrollbackData: scrollback,
    });

    const managed = manager.getSession('recover-1');
    const stored = managed?.ringBuffer.readAll().toString();
    expect(stored).toBe('previous terminal output\r\n$ ls\r\nfile.txt');
    expect(session.id).toBe('recover-1');
  });

  // Session recovery: preserves original createdAt
  it('preserves original createdAt when provided', () => {
    const originalDate = '2025-01-15T10:30:00.000Z';
    const session = manager.createSession({
      id: 'recover-2',
      cmd: 'cmd.exe',
      cwd: '.',
      createdAt: originalDate,
    });

    expect(session.createdAt).toBe(originalDate);
  });

  // listManagedSessions returns ManagedSession objects
  it('listManagedSessions returns internal managed sessions', () => {
    manager.createSession({ id: 'm1', cmd: 'cmd.exe', cwd: '.' });
    manager.createSession({ id: 'm2', cmd: 'cmd.exe', cwd: '.' });

    const managed = manager.listManagedSessions();
    expect(managed).toHaveLength(2);
    expect(managed[0].ringBuffer).toBeDefined();
    expect(managed[0].bridge).toBeDefined();
    expect(managed[0].ptyProcess).toBeDefined();
  });
});
