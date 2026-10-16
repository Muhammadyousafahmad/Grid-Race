import { describe, it, expect } from 'vitest';
import { getPeerConfig, NetworkController, isLocalhost } from '../src/logic/NetworkController';

describe('NetworkController configuration', () => {
  it('generates local development configuration for localhost', () => {
    const config = getPeerConfig(true);

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(9000);
    expect(config.path).toBe('/myapp');
    expect(config.secure).toBe(false);

    // Verifies Google STUN servers in iceServers configuration
    const iceUrls = config.config?.iceServers?.flatMap((s: any) =>
      Array.isArray(s.urls) ? s.urls : [s.urls]
    );
    expect(iceUrls).toContain('stun:stun.l.google.com:19302');
  });

  it('generates production configuration when not localhost', () => {
    const config = getPeerConfig(false);

    expect(config.host).toBe('0.peerjs.com');
    expect(config.port).toBe(443);
    expect(config.path).toBe('/');
    expect(config.secure).toBe(true);

    const iceUrls = config.config?.iceServers?.flatMap((s: any) =>
      Array.isArray(s.urls) ? s.urls : [s.urls]
    );
    expect(iceUrls).toContain('stun:stun.l.google.com:19302');
  });

  it('normalizes room code to uppercase and trimmed', () => {
    const controller = new NetworkController(true, '  ab12c  ');
    expect(controller.roomCode).toBe('AB12C');
    expect(controller.isHost).toBe(true);
  });

  it('isLocalhost returns boolean without throwing in test environment', () => {
    expect(typeof isLocalhost()).toBe('boolean');
  });
});

