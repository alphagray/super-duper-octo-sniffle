/**
 * Tests for Content Generation Serverless Function
 * 
 * Comprehensive test suite covering:
 * - Request validation
 * - Rate limiting (1 per epoch per IP)
 * - Content caching
 * - Cost estimation
 * - Error handling
 * - Response validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import type { GameAIContent } from '../../src/types/personalities';

describe('Content Generation API', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let testEpochCounter = 1000;

  // Helper to generate unique test epochs
  const getUniqueTestEpoch = () => {
    testEpochCounter++;
    return testEpochCounter;
  };

  // Mock content for testing
  const mockContent: GameAIContent = {
    version: '1.0.0',
    epoch: 1,
    generatedAt: Date.now(),
    environment: 'production',
    vendors: [
      {
        id: 'test-vendor-1',
        name: 'Test Vendor',
        description: 'Test vendor personality',
        productType: 'snacks',
        traits: [
          { id: 'trait-1', name: 'Test', description: 'Test trait', intensity: 0.5, tags: ['test'] }
        ],
        dialogue: [
          {
            id: 'dialogue-1',
            text: 'Test dialogue',
            context: { event: 'vendorServe' },
            emotion: 'neutral',
            priority: 50,
            cooldown: 5000
          }
        ],
        movement: {
          speed: 50,
          pauseDuration: 2000,
          sectionPreferences: {},
          avoidsActiveWave: false
        },
        appearance: {
          spriteSheet: 'test-sprite',
          animations: ['walk'],
          colorPalette: ['#FFFFFF'],
          scale: 1.0
        },
        metadata: {
          model: 'claude-3-haiku-20240307',
          temperature: 0.8,
          promptTokens: 100,
          completionTokens: 200,
          cost: 0.05,
          generatedAt: Date.now(),
          epoch: 1,
          usageCount: 0
        }
      }
    ],
    mascots: [
      {
        id: 'test-mascot-1',
        name: 'Test Mascot',
        description: 'Test mascot personality',
        theme: 'character',
        traits: [
          { id: 'trait-1', name: 'Test', description: 'Test trait', intensity: 0.5, tags: ['test'] }
        ],
        dialogue: [
          {
            id: 'dialogue-1',
            text: 'Test dialogue',
            context: { event: 'mascotActivate' },
            emotion: 'celebratory',
            priority: 50,
            cooldown: 5000
          }
        ],
        abilities: [
          {
            id: 'ability-1',
            name: 'Test Ability',
            description: 'Test ability',
            cooldown: 30000,
            duration: 5000,
            effects: [
              { stat: 'happiness', type: 'add', value: 10, target: 'allSections' }
            ]
          }
        ],
        appearance: {
          spriteSheet: 'test-sprite',
          animations: ['dance'],
          colorPalette: ['#FFFFFF'],
          scale: 1.0
        },
        metadata: {
          model: 'claude-3-haiku-20240307',
          temperature: 0.8,
          promptTokens: 100,
          completionTokens: 200,
          cost: 0.05,
          generatedAt: Date.now(),
          epoch: 1,
          usageCount: 0
        }
      }
    ],
    announcers: [
      {
        id: 'test-announcer-1',
        name: 'Test Announcer',
        description: 'Test announcer',
        style: 'energetic',
        traits: [
          { id: 'trait-1', name: 'Test', description: 'Test trait', intensity: 0.5, tags: ['test'] }
        ],
        commentary: [
          {
            id: 'commentary-1',
            text: 'Test commentary',
            context: { event: 'waveStart' },
            emotion: 'excited',
            priority: 50,
            cooldown: 5000
          }
        ],
        catchphrases: [],
        metadata: {
          model: 'claude-3-haiku-20240307',
          temperature: 0.8,
          promptTokens: 100,
          completionTokens: 200,
          cost: 0.05,
          generatedAt: Date.now(),
          epoch: 1,
          usageCount: 0
        }
      }
    ],
    metadata: {
      totalItems: 3,
      totalCost: 0.15,
      totalTokens: 600,
      generationTime: 1000,
      status: 'complete',
      errors: []
    }
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
      const handler = (await import('../generate-content')).default;
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
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).not.toBe(405);
    });

    it('should handle OPTIONS preflight', async () => {
      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'OPTIONS',
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Request Validation', () => {
    it('should reject requests without epoch', async () => {
      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: {}, // Missing epoch
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      expect(JSON.parse(res._getData()).error).toContain('Invalid request');
    });

    it('should reject requests with invalid epoch type', async () => {
      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: 'not-a-number' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should reject requests with negative epoch', async () => {
      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: -1 },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
    });

    it('should accept valid epoch', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).not.toBe(400);
    });

    it('should accept optional environment parameter', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch(), environment: 'development' },
      });

      await handler(req, res);

      expect(res._getStatusCode()).not.toBe(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow first request per epoch per IP', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const testEpoch = getUniqueTestEpoch();
      const { req, res } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.100.1' },
        body: { epoch: testEpoch },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
    });

    it('should block duplicate requests for same epoch from same IP', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const testEpoch = getUniqueTestEpoch();
      const testIp = '192.168.100.2';

      // First request should succeed
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: { epoch: testEpoch },
      });
      await handler(req1, res1);
      expect(res1._getStatusCode()).toBe(200);
      expect(JSON.parse(res1._getData()).cached).toBe(false);

      // Second request for same epoch from same IP should be rate limited
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': testIp },
        body: { epoch: testEpoch },
      });
      await handler(req2, res2);
      
      expect(res2._getStatusCode()).toBe(429);
      const data = JSON.parse(res2._getData());
      expect(data.error).toContain('Rate limit');
      expect(data.resetIn).toBeDefined();
    });

    it('should allow different IPs to request same epoch', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const testEpoch = getUniqueTestEpoch();

      // IP 1 request
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.100.3' },
        body: { epoch: testEpoch },
      });
      await handler(req1, res1);
      expect(res1._getStatusCode()).toBe(200);

      // IP 2 request for same epoch should also succeed (from cache)
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.100.4' },
        body: { epoch: testEpoch },
      });
      await handler(req2, res2);
      expect(res2._getStatusCode()).toBe(200);
    });
  });

  describe('Content Caching', () => {
    it('should cache generated content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });
      global.fetch = mockFetch;

      const handler = (await import('../generate-content')).default;
      const testEpoch = getUniqueTestEpoch();

      // First request - should call API
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.100.5' },
        body: { epoch: testEpoch },
      });
      await handler(req1, res1);
      expect(res1._getStatusCode()).toBe(200);
      const data1 = JSON.parse(res1._getData());
      expect(data1.cached).toBe(false);

      // Second request from different IP - should use cache
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.100.6' },
        body: { epoch: testEpoch },
      });
      await handler(req2, res2);
      expect(res2._getStatusCode()).toBe(200);
      const data2 = JSON.parse(res2._getData());
      expect(data2.cached).toBe(true);

      // API should only be called once
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should bypass cache when force=true', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 300, output_tokens: 600 }
        })
      });
      global.fetch = mockFetch;

      const handler = (await import('../generate-content')).default;
      const testEpoch = getUniqueTestEpoch();

      // First request
      const { req: req1, res: res1 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.100.7' },
        body: { epoch: testEpoch },
      });
      await handler(req1, res1);

      // Force regeneration
      const { req: req2, res: res2 } = createMocks({
        method: 'POST',
        headers: { 'x-forwarded-for': '192.168.100.8' },
        body: { epoch: testEpoch, force: true },
      });
      await handler(req2, res2);
      
      const data = JSON.parse(res2._getData());
      expect(data.cached).toBe(false);

      // API should be called twice
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cost Estimation', () => {
    it('should include cost estimate in response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 1000, output_tokens: 2000 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.costEstimate).toBeDefined();
      expect(typeof data.costEstimate).toBe('number');
      expect(data.costEstimate).toBeGreaterThan(0);
    });

    it('should include token usage breakdown', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 1000, output_tokens: 2000 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      expect(data.tokenUsage).toBeDefined();
      expect(data.tokenUsage.prompt).toBeDefined();
      expect(data.tokenUsage.completion).toBeDefined();
      expect(data.tokenUsage.total).toBeDefined();
    });

    it('should include generation time', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 1000, output_tokens: 2000 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      expect(data.generationTime).toBeDefined();
      expect(typeof data.generationTime).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should return 500 on missing API key', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData()).error).toContain('configuration');
    });

    it('should handle Claude API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData())).toHaveProperty('error');
    });

    it('should handle network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      const data = JSON.parse(res._getData());
      expect(data.error).toBeDefined();
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'invalid json {]' }],
          usage: { input_tokens: 100, output_tokens: 200 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
    });

    it('should not leak sensitive information in errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('API_KEY_INVALID: sk-ant-12345'));

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      const data = JSON.parse(res._getData());
      // Should NOT contain actual error message or API key
      expect(JSON.stringify(data)).not.toContain('sk-ant');
      expect(JSON.stringify(data)).not.toContain('API_KEY_INVALID');
    });
  });

  describe('Response Format', () => {
    it('should return content in correct format', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(mockContent) }],
          usage: { input_tokens: 1000, output_tokens: 2000 }
        })
      });

      const handler = (await import('../generate-content')).default;
      const { req, res } = createMocks({
        method: 'POST',
        body: { epoch: getUniqueTestEpoch() },
      });

      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data).toHaveProperty('content');
      expect(data).toHaveProperty('cached');
      expect(data).toHaveProperty('costEstimate');
      expect(data).toHaveProperty('tokenUsage');
      expect(data).toHaveProperty('generationTime');
    });
  });
});
