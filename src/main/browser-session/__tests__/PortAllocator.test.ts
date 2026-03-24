import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PortAllocator } from '../PortAllocator';

describe('PortAllocator', () => {
  let allocator: PortAllocator;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.WMUX_CDP_PORT;
    allocator = new PortAllocator();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should allocate a port within the default range (18800-18899)', async () => {
    const port = await allocator.allocate();
    expect(port).toBeGreaterThanOrEqual(18800);
    expect(port).toBeLessThanOrEqual(18899);
  });

  it('should return a valid port number from allocate()', async () => {
    const port = await allocator.allocate();
    expect(typeof port).toBe('number');
    expect(Number.isInteger(port)).toBe(true);
  });

  it('should return the same port on duplicate allocate() calls', async () => {
    const port1 = await allocator.allocate();
    const port2 = await allocator.allocate();
    expect(port1).toBe(port2);
  });

  it('should return null from getPort() after release()', async () => {
    const port = await allocator.allocate();
    allocator.release(port);
    expect(allocator.getPort()).toBeNull();
  });

  it('should use WMUX_CDP_PORT env var when set within range', async () => {
    process.env.WMUX_CDP_PORT = '18850';
    const envAllocator = new PortAllocator();
    const port = await envAllocator.allocate();
    expect(port).toBe(18850);
  });

  it('should throw when WMUX_CDP_PORT is out of range', async () => {
    process.env.WMUX_CDP_PORT = '9999';
    const envAllocator = new PortAllocator();
    await expect(envAllocator.allocate()).rejects.toThrow(
      'WMUX_CDP_PORT 9999 is out of range (18800-18899)'
    );
  });

  it('should support custom port range via constructor', async () => {
    const custom = new PortAllocator({ min: 30000, max: 30010 });
    const port = await custom.allocate();
    expect(port).toBeGreaterThanOrEqual(30000);
    expect(port).toBeLessThanOrEqual(30010);
  });

  it('should return null from getPort() before any allocation', () => {
    expect(allocator.getPort()).toBeNull();
  });

  it('should return the allocated port from getPort() after allocation', async () => {
    const port = await allocator.allocate();
    expect(allocator.getPort()).toBe(port);
  });
});
