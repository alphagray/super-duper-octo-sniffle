import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnnouncerService } from '@/managers/AnnouncerService';
import axios from 'axios';

// Mock axios
vi.mock('axios');

describe('AnnouncerService', () => {
  let announcer: AnnouncerService;

  beforeEach(() => {
    announcer = new AnnouncerService();
    vi.clearAllMocks();
  });

  describe('getCommentary', () => {
    it('should call backend proxy endpoint', async () => {
      const mockResponse = {
        data: {
          commentary: 'The crowd goes WILD!',
          cached: false
        }
      };
      
      (axios.post as any).mockResolvedValueOnce(mockResponse);

      const result = await announcer.getCommentary('Wave starting in section A!');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/announcer',
        { gameContext: 'Wave starting in section A!' },
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' }
        })
      );
      expect(result).toBe('The crowd goes WILD!');
    });

    it('should handle successful API response', async () => {
      const mockCommentary = 'Section A is ON FIRE!';
      (axios.post as any).mockResolvedValueOnce({
        data: { commentary: mockCommentary, cached: false }
      });

      const result = await announcer.getCommentary('Section A scored!');
      
      expect(result).toBe(mockCommentary);
    });

    it('should handle 429 rate limit gracefully', async () => {
      const error = new Error('Rate limit exceeded');
      (error as any).response = {
        status: 429,
        data: { error: 'Rate limit exceeded', resetIn: 30 }
      };
      (axios.post as any).mockRejectedValueOnce(error);

      const result = await announcer.getCommentary('Wave starting!');
      
      // Should return fallback
      expect(result).toBe('The crowd goes wild!');
    });

    it('should return fallback on network error', async () => {
      (axios.post as any).mockRejectedValueOnce(new Error('Network error'));

      const result = await announcer.getCommentary('Wave complete!');
      
      // Should return fallback, not throw
      expect(result).toBe('The crowd goes wild!');
    });

    it('should return fallback on 500 server error', async () => {
      const error = new Error('Server error');
      (error as any).response = {
        status: 500,
        data: { error: 'Internal server error' }
      };
      (axios.post as any).mockRejectedValueOnce(error);

      const result = await announcer.getCommentary('Section failed!');
      
      expect(result).toBe('The crowd goes wild!');
    });

    it('should return fallback on 400 bad request', async () => {
      const error = new Error('Bad request');
      (error as any).response = {
        status: 400,
        data: { error: 'Invalid request format' }
      };
      (axios.post as any).mockRejectedValueOnce(error);

      const result = await announcer.getCommentary('');
      
      expect(result).toBe('The crowd goes wild!');
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 8000ms exceeded');
      timeoutError.name = 'ECONNABORTED';
      (axios.post as any).mockRejectedValueOnce(timeoutError);

      const result = await announcer.getCommentary('Game event');
      
      expect(result).toBe('The crowd goes wild!');
    });

    it('should handle empty response gracefully', async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { commentary: '' }
      });

      const result = await announcer.getCommentary('Event');
      
      // Empty string is still a valid return
      expect(result).toBe('');
    });

    it('should handle missing commentary field', async () => {
      (axios.post as any).mockResolvedValueOnce({
        data: { cached: false }
      });

      const result = await announcer.getCommentary('Event');
      
      // Should handle undefined commentary gracefully
      expect(result).toBeUndefined();
    });

    it('should pass gameContext correctly', async () => {
      const mockResponse = {
        data: { commentary: 'Test', cached: false }
      };
      (axios.post as any).mockResolvedValueOnce(mockResponse);

      const gameContext = 'Wave in section B with score 500 and 2x multiplier';
      await announcer.getCommentary(gameContext);

      expect(axios.post).toHaveBeenCalledWith(
        '/api/announcer',
        { gameContext },
        expect.any(Object)
      );
    });
  });

  describe('Error handling', () => {
    it('should log errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      (axios.post as any).mockRejectedValueOnce(error);

      await announcer.getCommentary('Event');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch announcer commentary:',
        error
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should not throw errors on failure', async () => {
      (axios.post as any).mockRejectedValueOnce(new Error('Network failure'));

      // Should not throw
      await expect(
        announcer.getCommentary('Event')
      ).resolves.toBe('The crowd goes wild!');
    });
  });

  describe('Configuration', () => {
    it('should use default endpoint when VITE_API_ENDPOINT not set', () => {
      // The constructor uses import.meta.env.VITE_API_ENDPOINT || '/api/announcer'
      // By default in tests, it should use '/api/announcer'
      
      const mockResponse = {
        data: { commentary: 'Test', cached: false }
      };
      (axios.post as any).mockResolvedValueOnce(mockResponse);

      announcer.getCommentary('Test');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/announcer',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });
});
