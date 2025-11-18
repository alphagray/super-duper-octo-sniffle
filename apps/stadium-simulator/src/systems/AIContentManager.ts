/**
 * AI Content Manager
 * 
 * Browser-based content persistence using IndexedDB with fallback to bundled static content.
 * Handles content lifecycle, caching, and epoch-based regeneration.
 * 
 * Features:
 * - IndexedDB storage using `idb` wrapper
 * - Epoch-based deterministic seed generation
 * - Metadata tracking for generations and costs
 * - Graceful degradation on storage failures
 * - Singleton pattern for global access
 */

import { openDB, type IDBPDatabase } from 'idb';
import type {
  GameAIContent,
  ContentCacheEntry,
  ContentMetadata,
  ContentSetMetadata,
} from '@/types/personalities';
import { getCurrentEpoch, type Environment } from '@/config/ai-config';

/**
 * Database configuration
 */
const DB_NAME = 'stadium-simulator-ai-content';
const DB_VERSION = 1;
const STORE_CONTENT_EPOCHS = 'content-epochs';
const STORE_METADATA = 'metadata';

/**
 * Database schema for typed access
 */
interface AIContentDB {
  [STORE_CONTENT_EPOCHS]: {
    key: string;
    value: ContentCacheEntry;
  };
  [STORE_METADATA]: {
    key: string;
    value: ContentMetadata;
  };
}

/**
 * AI Content Manager
 * 
 * Manages AI-generated content with IndexedDB persistence and static fallback.
 * Uses singleton pattern to ensure single database connection.
 */
export class AIContentManager {
  private static instance: AIContentManager | null = null;
  private db: IDBPDatabase<AIContentDB> | null = null;
  private fallbackContent: GameAIContent | null = null;
  private initializationPromise: Promise<void> | null = null;
  private environment: Environment;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(environment: Environment = 'production') {
    this.environment = environment;
  }

  /**
   * Get singleton instance of AIContentManager
   * 
   * @param environment - Environment type (development or production)
   * @returns AIContentManager instance
   * 
   * @example
   * ```typescript
   * const manager = AIContentManager.getInstance();
   * const content = await manager.getContent();
   * ```
   */
  public static getInstance(environment: Environment = 'production'): AIContentManager {
    if (!AIContentManager.instance) {
      AIContentManager.instance = new AIContentManager(environment);
    }
    return AIContentManager.instance;
  }

  /**
   * Initialize the database connection and load fallback content
   * 
   * @returns Promise that resolves when initialization is complete
   */
  private async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // Initialize IndexedDB
        await this.initializeDatabase();
      } catch (error) {
        console.warn('Failed to initialize IndexedDB, will use fallback only:', error);
      }

      // Load fallback content
      await this.loadFallbackContent();
    })();

    return this.initializationPromise;
  }

  /**
   * Initialize IndexedDB with required object stores
   */
  private async initializeDatabase(): Promise<void> {
    try {
      this.db = await openDB<AIContentDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Create content-epochs store if it doesn't exist
          if (!db.objectStoreNames.contains(STORE_CONTENT_EPOCHS)) {
            db.createObjectStore(STORE_CONTENT_EPOCHS);
          }

          // Create metadata store if it doesn't exist
          if (!db.objectStoreNames.contains(STORE_METADATA)) {
            db.createObjectStore(STORE_METADATA);
          }
        },
      });
    } catch (error) {
      console.error('Failed to open IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Load fallback content from static JSON file
   */
  private async loadFallbackContent(): Promise<void> {
    try {
      const response = await fetch('/stadium-simulator/assets/ai-content-static.json');
      if (!response.ok) {
        throw new Error(`Failed to load fallback content: ${response.statusText}`);
      }
      this.fallbackContent = await response.json();
    } catch (error) {
      console.error('Failed to load fallback content:', error);
      // Create minimal fallback if static file fails to load
      this.fallbackContent = this.createMinimalFallback();
    }
  }

  /**
   * Create minimal fallback content for complete failure scenarios
   */
  private createMinimalFallback(): GameAIContent {
    const now = Date.now();
    const epoch = getCurrentEpoch(now, this.environment);

    return {
      version: '1.0.0-fallback',
      epoch,
      generatedAt: now,
      environment: this.environment,
      vendors: [],
      mascots: [],
      announcers: [],
      metadata: {
        totalItems: 0,
        totalCost: 0,
        totalTokens: 0,
        generationTime: 0,
        status: 'cached',
      },
    };
  }

  /**
   * Generate deterministic seed from epoch number
   * 
   * Uses a simple hash function to create a deterministic seed that:
   * - Is consistent for the same epoch across all clients
   * - Changes predictably between epochs
   * - Is suitable for content variation
   * 
   * @param epoch - Epoch number
   * @returns Deterministic seed string
   */
  private generateSeedFromEpoch(epoch: number): string {
    // Create deterministic hash using epoch and environment
    const seedInput = `${this.environment}-epoch-${epoch}`;
    
    // Simple hash function (djb2 algorithm)
    let hash = 5381;
    for (let i = 0; i < seedInput.length; i++) {
      hash = ((hash << 5) + hash) + seedInput.charCodeAt(i);
      hash = hash | 0; // Convert to 32-bit signed integer
    }
    
    // Convert to positive hex string, always 8 characters
    return Math.abs(hash).toString(16).slice(-8).padStart(8, '0');
  }

  /**
   * Generate cache key for content
   * 
   * @param epoch - Epoch number
   * @param environment - Environment type
   * @returns Cache key string
   */
  private generateCacheKey(epoch: number, environment: Environment): string {
    return `${environment}-epoch-${epoch}`;
  }

  /**
   * Get content for the current epoch
   * 
   * Attempts to retrieve content from cache, falling back to static content if:
   * - Cache miss occurs
   * - IndexedDB is unavailable
   * - Content is expired
   * 
   * @param timestamp - Optional timestamp (defaults to current time)
   * @returns Promise resolving to GameAIContent
   * 
   * @example
   * ```typescript
   * const manager = AIContentManager.getInstance();
   * const content = await manager.getContent();
   * console.log(`Loaded ${content.vendors.length} vendors`);
   * ```
   */
  public async getContent(timestamp: number = Date.now()): Promise<GameAIContent> {
    // Ensure initialization
    await this.initialize();

    const epoch = getCurrentEpoch(timestamp, this.environment);
    const cacheKey = this.generateCacheKey(epoch, this.environment);

    // Try to get from cache
    const cachedContent = await this.getCachedContent(cacheKey);
    if (cachedContent) {
      return cachedContent;
    }

    // Return fallback content
    return this.getFallbackContent(epoch);
  }

  /**
   * Get cached content from IndexedDB
   * 
   * @param cacheKey - Cache key to retrieve
   * @returns Promise resolving to GameAIContent or null if not found
   */
  private async getCachedContent(cacheKey: string): Promise<GameAIContent | null> {
    if (!this.db) {
      return null;
    }

    try {
      const entry = await this.db.get(STORE_CONTENT_EPOCHS, cacheKey);
      
      if (!entry) {
        return null;
      }

      // Check if content is expired
      if (entry.expiresAt < Date.now()) {
        // Clean up expired content
        await this.db.delete(STORE_CONTENT_EPOCHS, cacheKey);
        return null;
      }

      // Update access metadata
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
      await this.db.put(STORE_CONTENT_EPOCHS, entry, cacheKey);

      return entry.content;
    } catch (error) {
      console.error('Failed to retrieve cached content:', error);
      return null;
    }
  }

  /**
   * Get fallback content with epoch information
   * 
   * @param epoch - Current epoch number
   * @returns GameAIContent with epoch information
   */
  private getFallbackContent(epoch: number): GameAIContent {
    if (!this.fallbackContent) {
      return this.createMinimalFallback();
    }

    // Clone fallback content and update epoch information
    return {
      ...this.fallbackContent,
      epoch,
      generatedAt: Date.now(),
      environment: this.environment,
    };
  }

  /**
   * Store content in cache
   * 
   * @param content - Content to cache
   * @param expiresAt - Expiration timestamp
   * @returns Promise that resolves when content is stored
   * 
   * @example
   * ```typescript
   * const manager = AIContentManager.getInstance();
   * const content = generateContent(); // Your content generation logic
   * const nextEpochStart = getEpochStartTime(currentEpoch + 1);
   * await manager.storeContent(content, nextEpochStart);
   * ```
   */
  public async storeContent(content: GameAIContent, expiresAt: number): Promise<void> {
    await this.initialize();

    if (!this.db) {
      console.warn('Cannot store content: IndexedDB not available');
      return;
    }

    const cacheKey = this.generateCacheKey(content.epoch, content.environment);
    
    const entry: ContentCacheEntry = {
      key: cacheKey,
      content,
      cachedAt: Date.now(),
      expiresAt,
      accessCount: 0,
    };

    try {
      await this.db.put(STORE_CONTENT_EPOCHS, entry, cacheKey);
    } catch (error) {
      console.error('Failed to store content in cache:', error);
      // Non-fatal: just log the error
    }
  }

  /**
   * Get metadata for a specific content item
   * 
   * @param contentId - ID of the content item
   * @returns Promise resolving to ContentMetadata or null
   */
  public async getMetadata(contentId: string): Promise<ContentMetadata | null> {
    await this.initialize();

    if (!this.db) {
      return null;
    }

    try {
      return await this.db.get(STORE_METADATA, contentId) || null;
    } catch (error) {
      console.error('Failed to retrieve metadata:', error);
      return null;
    }
  }

  /**
   * Store metadata for a content item
   * 
   * @param contentId - ID of the content item
   * @param metadata - Metadata to store
   * @returns Promise that resolves when metadata is stored
   */
  public async storeMetadata(contentId: string, metadata: ContentMetadata): Promise<void> {
    await this.initialize();

    if (!this.db) {
      console.warn('Cannot store metadata: IndexedDB not available');
      return;
    }

    try {
      await this.db.put(STORE_METADATA, metadata, contentId);
    } catch (error) {
      console.error('Failed to store metadata:', error);
    }
  }

  /**
   * Clear all cached content (useful for testing and cleanup)
   * 
   * @returns Promise that resolves when cache is cleared
   */
  public async clearCache(): Promise<void> {
    await this.initialize();

    if (!this.db) {
      return;
    }

    try {
      await this.db.clear(STORE_CONTENT_EPOCHS);
      await this.db.clear(STORE_METADATA);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Get deterministic seed for current epoch
   * 
   * @param timestamp - Optional timestamp (defaults to current time)
   * @returns Deterministic seed string
   */
  public getSeedForEpoch(timestamp: number = Date.now()): string {
    const epoch = getCurrentEpoch(timestamp, this.environment);
    return this.generateSeedFromEpoch(epoch);
  }

  /**
   * Check if content exists for a specific epoch
   * 
   * @param epoch - Epoch number to check
   * @returns Promise resolving to true if content exists
   */
  public async hasContentForEpoch(epoch: number): Promise<boolean> {
    await this.initialize();

    if (!this.db) {
      return false;
    }

    const cacheKey = this.generateCacheKey(epoch, this.environment);
    
    try {
      const entry = await this.db.get(STORE_CONTENT_EPOCHS, cacheKey);
      return entry !== undefined && entry.expiresAt > Date.now();
    } catch (error) {
      console.error('Failed to check content existence:', error);
      return false;
    }
  }
}

// Export singleton instance getter as default
export default AIContentManager.getInstance;
