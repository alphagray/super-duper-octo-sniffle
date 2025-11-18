# AI Content Manager Documentation

## Overview

The `AIContentManager` is a browser-based content persistence system that uses IndexedDB with fallback to bundled static content. It handles AI-generated content lifecycle, caching, and epoch-based regeneration for the Stadium Simulator game.

## Features

- **IndexedDB Storage**: Persistent browser storage for AI-generated content
- **Epoch-Based Caching**: Deterministic content rotation based on time periods
- **Static Fallback**: Graceful degradation to bundled content when generation/storage unavailable
- **Singleton Pattern**: Global access with single database connection
- **Graceful Error Handling**: Works offline and when IndexedDB is unavailable

## Quick Start

```typescript
import { AIContentManager } from '@/systems/AIContentManager';

// Get singleton instance
const manager = AIContentManager.getInstance('production');

// Retrieve content for current epoch
const content = await manager.getContent();

// Access personalities
console.log(`Loaded ${content.vendors.length} vendors`);
console.log(`Loaded ${content.mascots.length} mascots`);
console.log(`Loaded ${content.announcers.length} announcers`);
```

## API Reference

### Getting Content

```typescript
// Get content for current time
const content = await manager.getContent();

// Get content for specific timestamp
const content = await manager.getContent(timestamp);
```

Returns a `GameAIContent` object containing:
- `vendors`: Array of vendor personalities
- `mascots`: Array of mascot personalities
- `announcers`: Array of announcer content
- `epoch`: Current epoch number
- `metadata`: Generation metadata and statistics

### Storing Generated Content

```typescript
import { getEpochStartTime, getCurrentEpoch } from '@/config/ai-config';

// Generate or fetch your content
const generatedContent: GameAIContent = {
  version: '1.0.0',
  epoch: getCurrentEpoch(),
  generatedAt: Date.now(),
  environment: 'production',
  vendors: [...],
  mascots: [...],
  announcers: [...],
  metadata: {...}
};

// Calculate expiration (next epoch start)
const currentEpoch = getCurrentEpoch();
const expiresAt = getEpochStartTime(currentEpoch + 1, 'production');

// Store in cache
await manager.storeContent(generatedContent, expiresAt);
```

### Metadata Operations

```typescript
// Store metadata for a content item
await manager.storeMetadata('vendor-id', {
  model: 'claude-3-5-sonnet-20241022',
  temperature: 0.7,
  promptTokens: 500,
  completionTokens: 1000,
  cost: 15, // in cents
  generatedAt: Date.now(),
  epoch: getCurrentEpoch(),
  usageCount: 0
});

// Retrieve metadata
const metadata = await manager.getMetadata('vendor-id');
```

### Utility Methods

```typescript
// Get deterministic seed for current epoch
const seed = manager.getSeedForEpoch();

// Check if content exists for specific epoch
const exists = await manager.hasContentForEpoch(5);

// Clear all cached content
await manager.clearCache();
```

## Epoch System

The content manager uses an epoch-based system for deterministic content rotation:

- **Development**: 1-hour epochs for rapid testing
- **Production**: 24-hour epochs for daily content rotation
- **Epoch Zero**: January 1, 2025, 00:00:00 UTC

### Deterministic Seed Generation

Each epoch has a deterministic seed generated using the djb2 hash algorithm:

```typescript
const seed = manager.getSeedForEpoch(timestamp);
// Returns: "a1b2c3d4" (8-character hex string)
```

This ensures:
- Same seed for same epoch across all clients
- Predictable content variation between epochs
- Consistent content within an epoch period

## Cache Strategy

### Cache Hit Flow

1. Client requests content for current epoch
2. Manager checks IndexedDB for cached entry
3. If found and not expired, return cached content
4. Update access count and last accessed time

### Cache Miss Flow

1. Client requests content for current epoch
2. No cache entry found in IndexedDB
3. Manager returns static fallback content
4. Fallback content updated with current epoch info

### Cache Invalidation

Content automatically expires at epoch boundaries. When retrieving expired content:
1. Entry is deleted from IndexedDB
2. Fallback content is returned
3. New content can be generated and cached

## Fallback Content

Static fallback content is located at `/public/assets/ai-content-static.json` and includes:

- **2 Vendors**: Hotdog vendor (Frank) and drinks vendor (Rita)
- **1 Mascot**: Thunder the Stadium Bird with special abilities
- **2 Announcers**: Classic Jim (traditional) and Energetic Zoey (NBA Jam style)

Fallback is used when:
- IndexedDB is unavailable (browser doesn't support it)
- Cache miss occurs
- Storage operations fail
- Offline mode (fetch fails)

## Error Handling

The manager handles errors gracefully:

```typescript
// All operations are safe and won't throw
try {
  const content = await manager.getContent();
  // Will always return valid content (cached or fallback)
} catch (error) {
  // This should never happen
  console.error('Unexpected error:', error);
}
```

### Scenarios Handled

1. **IndexedDB Unavailable**: Falls back to static content
2. **Network Failure**: Uses cached or fallback content
3. **Storage Quota Exceeded**: Logs warning, continues with fallback
4. **Corrupt Cache Data**: Deletes invalid entry, returns fallback

## Browser Compatibility

- **Chrome/Edge**: Full support (IndexedDB + fallback)
- **Firefox**: Full support (IndexedDB + fallback)
- **Safari**: Full support (IndexedDB + fallback)
- **Older Browsers**: Fallback mode only (still functional)

## Testing

The manager includes 31 comprehensive tests covering:

```bash
npm test -- src/__tests__/systems/AIContentManager.test.ts
```

Test coverage includes:
- Singleton pattern enforcement
- Fallback content loading
- Cache hit/miss scenarios
- Epoch-based content rotation
- Deterministic seed generation
- Metadata operations
- Error handling
- Offline scenarios

## Performance Considerations

### Initialization

- Lazy initialization on first use
- Shared initialization promise prevents duplicate work
- Fallback content loaded once and cached in memory

### Storage Efficiency

- Content expires automatically at epoch boundaries
- Old epochs can be manually cleared via `clearCache()`
- Metadata stored separately for quick access

### Network Usage

- Static fallback bundled with app (no network request)
- Generated content cached to minimize API calls
- Deterministic epochs ensure cache hits across sessions

## Example: Complete Integration

```typescript
import { AIContentManager } from '@/systems/AIContentManager';
import { getCurrentEpoch, getEpochStartTime } from '@/config/ai-config';

async function loadGameContent() {
  // Get manager instance
  const manager = AIContentManager.getInstance('production');
  
  // Get content for current epoch
  const content = await manager.getContent();
  
  // Check if we need to generate fresh content
  const currentEpoch = getCurrentEpoch();
  const hasContent = await manager.hasContentForEpoch(currentEpoch);
  
  if (!hasContent) {
    console.log('Cache miss - using fallback content');
    // Optionally: Trigger background generation
    generateAndCacheContent(manager, currentEpoch);
  } else {
    console.log('Cache hit - using stored content');
  }
  
  return content;
}

async function generateAndCacheContent(
  manager: AIContentManager,
  epoch: number
) {
  // Your AI generation logic here
  const generated = await generateAIContent(epoch);
  
  // Cache for next time
  const expiresAt = getEpochStartTime(epoch + 1, 'production');
  await manager.storeContent(generated, expiresAt);
  
  console.log('Content generated and cached');
}
```

## Troubleshooting

### Content Not Persisting

- Check browser IndexedDB support: `console.log('indexedDB' in window)`
- Verify storage quota: Check browser DevTools → Application → Storage
- Clear cache if corrupt: `await manager.clearCache()`

### Fallback Always Used

- IndexedDB may be disabled in browser settings
- Check console for initialization errors
- Verify static fallback file exists at correct path

### Seed Not Deterministic

- Ensure same environment ('development' vs 'production')
- Verify timestamps are in same epoch period
- Check epoch calculation: `getCurrentEpoch(timestamp, environment)`

## Future Enhancements

Potential improvements for the content manager:

1. **Compression**: Compress content before storing to save space
2. **Service Worker Integration**: Sync cached content across tabs
3. **Partial Updates**: Update only changed personalities
4. **Version Migration**: Handle schema changes gracefully
5. **Analytics**: Track cache hit rates and storage usage
