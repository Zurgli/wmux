import * as net from 'net';

const DEFAULT_PORT_MIN = 18800;
const DEFAULT_PORT_MAX = 18899;

/**
 * Manages CDP port allocation for WinMux instances.
 * Prevents multi-instance port collisions by probing ports before assignment.
 */
export class PortAllocator {
  private readonly min: number;
  private readonly max: number;
  private allocatedPort: number | null = null;

  constructor(portRange?: { min: number; max: number }) {
    this.min = portRange?.min ?? DEFAULT_PORT_MIN;
    this.max = portRange?.max ?? DEFAULT_PORT_MAX;
  }

  /**
   * Allocate an available CDP port.
   * If WMUX_CDP_PORT env var is set and within range, tries that first.
   */
  async allocate(): Promise<number> {
    if (this.allocatedPort !== null) {
      return this.allocatedPort;
    }

    // Prefer env-specified port
    const envPort = process.env.WMUX_CDP_PORT
      ? Number(process.env.WMUX_CDP_PORT)
      : null;

    if (envPort !== null) {
      if (envPort < this.min || envPort > this.max) {
        throw new Error(
          `WMUX_CDP_PORT ${envPort} is out of range (${this.min}-${this.max})`
        );
      }
      if (await this.isPortAvailable(envPort)) {
        this.allocatedPort = envPort;
        return envPort;
      }
      throw new Error(`WMUX_CDP_PORT ${envPort} is already in use`);
    }

    // Scan range for an available port
    for (let port = this.min; port <= this.max; port++) {
      if (await this.isPortAvailable(port)) {
        this.allocatedPort = port;
        return port;
      }
    }

    throw new Error(
      `No available CDP port in range ${this.min}-${this.max}`
    );
  }

  /** Release the currently allocated port. */
  release(port: number): void {
    if (this.allocatedPort === port) {
      this.allocatedPort = null;
    }
  }

  /** Get the currently allocated port, or null if none. */
  getPort(): number | null {
    return this.allocatedPort;
  }

  /** Check if a port is available by attempting to bind a temporary server. */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });
  }
}
