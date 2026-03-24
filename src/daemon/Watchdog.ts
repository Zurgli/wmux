/**
 * Internal daemon health monitor.
 * Periodically checks daemon health metrics and logs warnings.
 * No Electron dependencies.
 */
export class Watchdog {
  private intervalId: NodeJS.Timeout | null = null;

  private static readonly MEMORY_WARNING_BYTES = 500 * 1024 * 1024; // 500 MB

  constructor(private readonly checkIntervalMs: number = 30000) {}

  /** Start periodic health checks. */
  start(healthCheck: () => { sessions: number; memory: number; uptime: number }): void {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      try {
        const health = healthCheck();

        if (health.memory > Watchdog.MEMORY_WARNING_BYTES) {
          console.log(
            `[Watchdog] WARNING: Memory usage ${(health.memory / 1024 / 1024).toFixed(1)}MB exceeds 500MB threshold`,
          );
        }

        console.log(
          `[Watchdog] Health: sessions=${health.sessions}, memory=${(health.memory / 1024 / 1024).toFixed(1)}MB, uptime=${health.uptime}s`,
        );
      } catch (err) {
        console.log(`[Watchdog] Health check failed:`, err);
      }
    }, this.checkIntervalMs);

    // Allow the timer to not block process exit
    if (this.intervalId.unref) {
      this.intervalId.unref();
    }
  }

  /** Stop the watchdog. */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
