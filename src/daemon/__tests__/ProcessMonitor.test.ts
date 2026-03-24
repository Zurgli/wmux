import { describe, it, expect, vi, afterEach } from 'vitest';
import { ProcessMonitor } from '../ProcessMonitor';

let monitor: ProcessMonitor;

afterEach(() => {
  if (monitor) {
    monitor.unwatchAll();
  }
});

describe('ProcessMonitor', () => {
  it('isAlive returns true for current process PID', () => {
    expect(ProcessMonitor.isAlive(process.pid)).toBe(true);
  });

  it('isAlive returns false for a non-existent PID', () => {
    // PID 99999999 is extremely unlikely to exist
    expect(ProcessMonitor.isAlive(99999999)).toBe(false);
  });

  it('watch calls onDead when process does not exist', async () => {
    vi.useFakeTimers();
    try {
      monitor = new ProcessMonitor();
      const onDead = vi.fn();

      // Watch a PID that does not exist
      monitor.watch('sess-fake', 99999999, onDead);

      // Advance past one check interval (5s)
      vi.advanceTimersByTime(5000);

      expect(onDead).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('unwatch stops monitoring a session', () => {
    vi.useFakeTimers();
    try {
      monitor = new ProcessMonitor();
      const onDead = vi.fn();

      monitor.watch('sess-1', 99999999, onDead);
      monitor.unwatch('sess-1');

      // Advance past check interval
      vi.advanceTimersByTime(10000);

      expect(onDead).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('unwatchAll stops monitoring all sessions', () => {
    vi.useFakeTimers();
    try {
      monitor = new ProcessMonitor();
      const onDead1 = vi.fn();
      const onDead2 = vi.fn();

      monitor.watch('sess-1', 99999999, onDead1);
      monitor.watch('sess-2', 99999998, onDead2);
      monitor.unwatchAll();

      // Advance past check interval
      vi.advanceTimersByTime(10000);

      expect(onDead1).not.toHaveBeenCalled();
      expect(onDead2).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('watch does not call onDead for a living process', () => {
    vi.useFakeTimers();
    try {
      monitor = new ProcessMonitor();
      const onDead = vi.fn();

      // Watch current process — should stay alive
      monitor.watch('sess-alive', process.pid, onDead);

      // Advance several intervals
      vi.advanceTimersByTime(20000);

      expect(onDead).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
