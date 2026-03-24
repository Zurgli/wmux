/**
 * Monitors child process liveness by periodically checking PID status.
 * No Electron dependencies — uses only Node.js APIs.
 */
export class ProcessMonitor {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  private static readonly CHECK_INTERVAL_MS = 5000;

  /** Check whether a process with the given PID is still alive. */
  static isAlive(pid: number): boolean {
    if (process.platform === 'win32') {
      // process.kill(pid, 0) is unreliable on Windows — always returns true.
      // Use tasklist which is available on all Windows versions.
      try {
        const { execFileSync } = require('child_process');
        const pathMod = require('path');
        const systemRoot = process.env.SystemRoot || 'C:\\Windows';
        const tasklist = pathMod.join(systemRoot, 'System32', 'tasklist.exe');
        const result: string = execFileSync(
          tasklist,
          ['/fi', `PID eq ${pid}`, '/fo', 'csv', '/nh'],
          { encoding: 'utf-8', timeout: 3000, windowsHide: true },
        );
        return result.includes(`"${pid}"`);
      } catch {
        return false;
      }
    }
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /** Start monitoring a process. Calls onDead when the process is no longer alive. */
  watch(sessionId: string, pid: number, onDead: () => void): void {
    // Clear any existing watcher for this session
    this.unwatch(sessionId);

    const interval = setInterval(() => {
      if (!ProcessMonitor.isAlive(pid)) {
        this.unwatch(sessionId);
        onDead();
      }
    }, ProcessMonitor.CHECK_INTERVAL_MS);

    // Allow the timer to not block process exit
    if (interval.unref) {
      interval.unref();
    }

    this.intervals.set(sessionId, interval);
  }

  /** Stop monitoring a specific session. */
  unwatch(sessionId: string): void {
    const interval = this.intervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(sessionId);
    }
  }

  /** Stop monitoring all sessions. */
  unwatchAll(): void {
    this.intervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.intervals.clear();
  }
}
