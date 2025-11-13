import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// We'll need to adjust imports based on actual implementation
// This assumes the handler is the default export

describe('Announcer API Security', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let testIpCounter = 0;

  // Helper to generate unique test IPs to avoid rate limiting conflicts
  const getUniqueTestIp = () => {
    testIpCounter++;
    return `192.168.${Math.floor(testIpCounter / 256)}.${testIpCounter % 256}`;
  };

  beforeEach(() => {
    // Save original env
    originalEnv = process.env;
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: 'test-key-12345' };
    
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('HTTP Method Validation', () => {
    it('should reject GET requests', async () => {
      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'GET',
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(JSON.parse(res._getData())).toEqual({
        error: 'Method not allowed'
      });
    });

    it('should accept POST requests', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Test' }] })
      });

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { event: 'waveStart', context: {} },
      });

      await handler(req, res);

      expect(res._getStatusCode()).not.toBe(405);
    });
  });

  describe('Input Validation', () => {
    it('should reject requests without event field', async () => {
      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { context: {} }, // Missing event
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData()).error).toContain('Invalid request');
    });

    it('should reject invalid event types', async () => {
      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { event: 'maliciousEvent' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should accept valid event types', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Valid!' }] })
      });

      const validEvents = ['waveStart', 'sectionSuccess', 'sectionFail', 'waveComplete'];
      const handler = (await import('../announcer')).default;

      for (const event of validEvents) {
        const { req, res } = createMocks({
          method: 'POST',
          body: { event, context: {} },
        });

        await handler(req, res);
        expect(res._getStatusCode()).not.toBe(400);
      }
    });

    it('should reject excessively long event strings', async () => {
      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { event: 'a'.repeat(100) }, // Too long
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under rate limit', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'OK' }] })
      });

      const handler = (await import('../announcer')).default;
      
      // Make 5 requests (under limit of 10)
      for (let i = 0; i < 5; i++) {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'x-forwarded-for': '192.168.1.100' },
          body: { event: 'waveStart', context: {} },
        });

        await handler(req, res);
        expect(res._getStatusCode()).toBe(200);
      }
    });

    it('should enforce rate limit after threshold', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'OK' }] })
      });

      const handler = (await import('../announcer')).default;
      const testIp = '192.168.1.50';
      
      // Make 11 requests (limit is 10)
      for (let i = 0; i < 11; i++) {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'x-forwarded-for': testIp },
          body: { event: 'waveStart', context: {} },
        });

        await handler(req, res);
        
        if (i < 10) {
          expect(res._getStatusCode()).toBe(200);
        } else {
          expect(res._getStatusCode()).toBe(429);
          const data = JSON.parse(res._getData());
          expect(data.error).toContain('Rate limit');
          expect(data.resetIn).toBeDefined();
        }
      }
    });

    it('should track rate limits per IP independently', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'OK' }] })
      });

      const handler = (await import('../announcer')).default;
      
      // IP 1: Make 10 requests
      for (let i = 0; i < 10; i++) {
        const { req, res } = createMocks({
          method: 'POST',
          headers: { 'x-forwarded-for': '192.168.1.1' },
          body: { event: 'waveStart', context: {} },
        });
        await handler(req, res);
      }

      // IP 2: Should still be able to make requests
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.1.2' },
        body: { event: 'waveStart', context: {} },
      });
      await handler(req, res);
      
      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('API Integration', () => {
    it('should call Claude API with correct parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'Commentary!' }] })
      });
      global.fetch = mockFetch;

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          event: 'waveStart',
          context: { score: 500, multiplier: 2.5 }
        },
      });

      await handler(req, res);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('anthropic.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-key-12345',
            'Content-Type': 'application/json'
          })
        })
      );

      // Verify request body structure
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody.model).toBe('claude-sonnet-4-20250514');
      expect(requestBody.max_tokens).toBeLessThanOrEqual(150);
      expect(requestBody.messages[0].role).toBe('user');
    });

    it('should include game context in prompt', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'Commentary!' }] })
      });
      global.fetch = mockFetch;

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          event: 'sectionFail',
          context: {
            section: 'B',
            thirst: 85,
            happiness: 30,
            reason: 'vendor blocking'
          }
        },
      });

      await handler(req, res);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      const prompt = requestBody.messages[0].content;

      // Verify context is included
      expect(prompt).toContain('Section B');
      expect(prompt).toContain('85');
      expect(prompt).toContain('vendor blocking');
    });

    it('should enforce timeout on API calls', async () => {
      // Mock a slow API call
      const mockFetch = vi.fn().mockImplementation(() => 
        new Promise((resolve) => setTimeout(resolve, 10000)) // 10 second delay
      );
      global.fetch = mockFetch;

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': getUniqueTestIp() },
        body: { event: 'waveStart', context: {} },
      });

      // Call should timeout and return error
      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
    }, 15000); // 15 second timeout for this test
  });

  describe('Error Handling', () => {
    it('should return 500 on missing API key', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': getUniqueTestIp() },
        body: { event: 'waveStart', context: {} },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData()).error).toContain('configuration');
    });

    it('should handle Claude API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      });

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': getUniqueTestIp() },
        body: { event: 'waveStart', context: {} },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toHaveProperty('error');
      expect(JSON.parse(res._getData())).toHaveProperty('fallback', true);
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network failure'));

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': getUniqueTestIp() },
        body: { event: 'waveStart', context: {} },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBeDefined();
      expect(data.fallback).toBe(true);
    });

    it('should not leak sensitive information in errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('API_KEY_INVALID: sk-ant-12345'));

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': getUniqueTestIp() },
        body: { event: 'waveStart', context: {} },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      // Should NOT contain actual error message or API key
      expect(data.error).not.toContain('sk-ant');
      expect(data.error).not.toContain('API_KEY_INVALID');
    });
  });

  describe('Response Format', () => {
    it('should return commentary in correct format', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'The crowd goes wild!' }]
        })
      });

      const handler = (await import('../announcer')).default;
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': getUniqueTestIp() },
        body: { event: 'waveStart', context: {} },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty('commentary');
      expect(data.commentary).toBe('The crowd goes wild!');
      expect(data).toHaveProperty('cached');
    });
  });
});
