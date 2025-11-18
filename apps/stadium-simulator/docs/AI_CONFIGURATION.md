# AI Configuration System Documentation

## Overview

The AI Configuration System provides deterministic, epoch-based content rotation for AI-generated game personalities (vendors, mascots, announcers). This system ensures consistent content generation while enabling cost tracking and budget enforcement.

## Configuration Files

### `src/config/ai-config.ts`

Central configuration for the AI content system.

#### Epoch Configuration

```typescript
aiConfig.epoch = {
  developmentDuration: 60 * 60 * 1000,      // 1 hour
  productionDuration: 24 * 60 * 60 * 1000,  // 24 hours
  epochZero: Date.UTC(2025, 0, 1, 0, 0, 0)  // Jan 1, 2025 00:00:00 UTC
}
```

**Purpose**: Controls how frequently AI content rotates.

- **Development**: 1-hour epochs for rapid iteration and testing
- **Production**: 24-hour epochs for stable, daily content rotation
- **Epoch Zero**: Reference timestamp for all epoch calculations

**Why Epochs?**
- Deterministic: Same timestamp always yields same epoch
- Cacheable: Content can be cached per epoch to reduce API costs
- Testable: Epoch calculations are pure functions with predictable output

#### Cost Configuration

```typescript
aiConfig.cost = {
  enabled: true,
  maxCostPerSession: 50,           // 50 cents per game session
  maxCostPerUserPerDay: 200,       // $2.00 per user per day
  estimatedCostPerCall: 5,         // 5 cents per API call
  warningThreshold: 0.8            // Warn at 80% of limit
}
```

**Purpose**: Prevents runaway API costs.

- **Session Limit**: Maximum cost for a single gameplay session
- **Daily Limit**: Maximum cost per user across all sessions in one day
- **Estimated Cost**: Conservative estimate for budget predictions
- **Warning Threshold**: Trigger alerts before hitting hard limits

**How to Adjust**:
- Increase `maxCostPerSession` if running out during gameplay
- Increase `maxCostPerUserPerDay` for heavy users
- Update `estimatedCostPerCall` based on actual Claude API pricing
- Lower `warningThreshold` (e.g., 0.6) for earlier warnings

#### Content Variation Configuration

```typescript
aiConfig.contentVariation = {
  enabled: true,
  variantsPerType: 5,              // 5 personality variants per type
  minRefreshInterval: 5 * 60 * 1000  // 5 minutes
}
```

**Purpose**: Controls content diversity and refresh frequency.

- **Variants Per Type**: How many different personalities to generate (vendor, mascot, announcer)
- **Min Refresh Interval**: Minimum time between content regeneration calls

**Tuning Guide**:
- Increase `variantsPerType` for more diversity (higher cost)
- Decrease `variantsPerType` to reduce API calls (lower cost)
- Increase `minRefreshInterval` to reduce API calls during gameplay

## Epoch System

### Core Functions

#### `getCurrentEpoch(timestamp?, environment?)`

Returns the current epoch number for a given timestamp.

```typescript
// Get current epoch in production
const epoch = getCurrentEpoch();

// Get epoch for specific timestamp in development
const testEpoch = getCurrentEpoch(Date.UTC(2025, 0, 2, 12, 0, 0), 'development');

// Deterministic: same input always yields same output
const epoch1 = getCurrentEpoch(1735689600000);
const epoch2 = getCurrentEpoch(1735689600000);
console.assert(epoch1 === epoch2);
```

**Parameters**:
- `timestamp` (optional): Unix timestamp in milliseconds (defaults to `Date.now()`)
- `environment` (optional): `'development'` or `'production'` (defaults to `'production'`)

**Returns**: Non-negative integer representing the epoch number

**Edge Cases**:
- Timestamps before epoch zero return `0`
- Boundary timestamps are deterministic (e.g., exact epoch start)
- Far future timestamps work correctly

#### `getEpochStartTime(epochNumber, environment?)`

Returns the start timestamp for a specific epoch.

```typescript
const epoch = getCurrentEpoch();
const epochStart = getEpochStartTime(epoch);
console.log(`Current epoch started at ${new Date(epochStart)}`);
```

#### `getEpochEndTime(epochNumber, environment?)`

Returns the end timestamp for a specific epoch (start of next epoch).

```typescript
const epoch = getCurrentEpoch();
const epochEnd = getEpochEndTime(epoch);
console.log(`Current epoch ends at ${new Date(epochEnd)}`);
```

#### `getTimeUntilNextEpoch(timestamp?, environment?)`

Returns milliseconds remaining until the next epoch.

```typescript
const msRemaining = getTimeUntilNextEpoch();
const minutesRemaining = Math.floor(msRemaining / 60000);
console.log(`${minutesRemaining} minutes until content refresh`);
```

#### `isInEpoch(timestamp, epochNumber, environment?)`

Checks if a timestamp falls within a specific epoch.

```typescript
const now = Date.now();
const currentEpoch = getCurrentEpoch(now);
console.assert(isInEpoch(now, currentEpoch) === true);
```

### Use Cases

#### Content Caching

```typescript
// Generate cache key based on epoch
const epoch = getCurrentEpoch();
const cacheKey = `content-v1-epoch-${epoch}-prod`;

// Check if cached content exists
const cached = cache.get(cacheKey);
if (cached) {
  return cached;
}

// Generate new content and cache it
const content = await generateAIContent();
cache.set(cacheKey, content, {
  expiresAt: getEpochEndTime(epoch)
});
```

#### Cost Budgeting

```typescript
// Check if we can make an API call
const estimatedCost = aiConfig.cost.estimatedCostPerCall;
const currentSessionCost = sessionCostTracker.getTotal();

if (currentSessionCost + estimatedCost > aiConfig.cost.maxCostPerSession) {
  // Use fallback content instead
  return getFallbackContent();
}

// Safe to make API call
const result = await callClaudeAPI();
sessionCostTracker.add(estimatedCost);
```

#### Content Refresh

```typescript
// Only refresh content when crossing epoch boundary
const lastRefreshEpoch = storage.getLastRefreshEpoch();
const currentEpoch = getCurrentEpoch();

if (currentEpoch > lastRefreshEpoch) {
  await refreshAIContent();
  storage.setLastRefreshEpoch(currentEpoch);
}
```

## Type System

### `src/types/personalities.ts`

Comprehensive TypeScript interfaces for all AI-generated content.

### Key Interfaces

#### `PersonalityTrait`
Defines a single characteristic of a personality (e.g., "sarcastic", "energetic").

#### `DialogueLine`
Represents a line of dialogue with context conditions and emotional tone.

#### `VendorPersonality`
Complete configuration for a stadium vendor including:
- Product type (drinks, snacks, merchandise, mixed)
- Movement behavior (speed, pause duration, section preferences)
- Dialogue lines
- Visual appearance

#### `MascotPersonality`
Complete configuration for a stadium mascot including:
- Theme (animal, object, character, abstract, sports)
- Special abilities with stat effects
- Dialogue and catchphrases
- Visual appearance and animations

#### `AnnouncerContent`
Complete configuration for the stadium announcer including:
- Commentary style (classic, energetic, sarcastic, professional, casual)
- Event-specific commentary
- Catchphrases for special moments
- Personality traits

#### `GameAIContent`
Top-level container for all AI content:
- Version and epoch information
- Collections of vendors, mascots, and announcers
- Aggregate metadata (total cost, generation time, quality scores)

#### `ContentMetadata`
Tracks generation details for a single content item:
- Model, temperature, token counts
- Cost in cents
- Generation timestamp and epoch
- Usage statistics

## Configuration Best Practices

### Development

1. **Use Development Environment**:
   - 1-hour epochs for faster testing
   - Lower cost limits for safety
   - More frequent content rotation

2. **Test Epoch Boundaries**:
   - Test content refresh at epoch transitions
   - Verify cache invalidation
   - Test with specific timestamps

### Production

1. **Use Production Environment**:
   - 24-hour epochs for stability
   - Realistic cost limits
   - Daily content rotation

2. **Monitor Costs**:
   - Track actual API costs vs estimates
   - Adjust `estimatedCostPerCall` based on data
   - Set appropriate warning thresholds

3. **Cache Aggressively**:
   - Cache AI content per epoch
   - Reuse content within same epoch
   - Only regenerate at epoch boundaries

### Testing

1. **Use Fixed Timestamps**:
   ```typescript
   const testDate = Date.UTC(2025, 0, 15, 12, 0, 0);
   const epoch = getCurrentEpoch(testDate, 'development');
   ```

2. **Test Determinism**:
   ```typescript
   const epoch1 = getCurrentEpoch(timestamp);
   const epoch2 = getCurrentEpoch(timestamp);
   expect(epoch1).toBe(epoch2);
   ```

3. **Test Boundaries**:
   ```typescript
   const epochZero = aiConfig.epoch.epochZero;
   const beforeEpoch1 = epochZero + duration - 1;
   const atEpoch1 = epochZero + duration;
   
   expect(getCurrentEpoch(beforeEpoch1)).toBe(0);
   expect(getCurrentEpoch(atEpoch1)).toBe(1);
   ```

## Migration Guide

### Adding New Configuration Options

1. Update interface in `ai-config.ts`:
   ```typescript
   export interface AIConfig {
     epoch: EpochConfig;
     cost: CostConfig;
     contentVariation: ContentVariationConfig;
     myNewFeature: MyNewFeatureConfig;  // Add here
   }
   ```

2. Update `aiConfig` constant:
   ```typescript
   export const aiConfig: AIConfig = {
     // ... existing config
     myNewFeature: {
       enabled: true,
       // ... config values
     }
   }
   ```

3. Add tests in `ai-config.test.ts`

### Changing Epoch Duration

**⚠️ Warning**: Changing epoch duration will invalidate all cached content.

```typescript
// Old: 24 hours
productionDuration: 24 * 60 * 60 * 1000

// New: 12 hours (will create new epochs)
productionDuration: 12 * 60 * 60 * 1000
```

**Migration Steps**:
1. Deploy configuration change
2. Clear all epoch-based caches
3. Allow system to regenerate content for new epoch schedule

### Changing Epoch Zero

**⚠️ Warning**: Changing epoch zero will completely reshuffle all epoch numbers.

Only change `epochZero` if absolutely necessary (e.g., fixing a bug). Consider it immutable after initial deployment.

## Troubleshooting

### Content Not Refreshing

**Symptom**: Same AI content appears after epoch boundary.

**Solutions**:
1. Verify cache invalidation logic
2. Check `getTimeUntilNextEpoch()` returns correct value
3. Confirm environment matches (dev vs prod)
4. Clear cache manually if needed

### Hitting Cost Limits Too Quickly

**Symptom**: Warning or error about cost limits during normal gameplay.

**Solutions**:
1. Increase `maxCostPerSession` or `maxCostPerUserPerDay`
2. Reduce `variantsPerType` to generate less content
3. Increase `minRefreshInterval` to reduce API calls
4. Implement better caching strategy

### Epoch Calculation Seems Wrong

**Symptom**: Unexpected epoch numbers or boundary behavior.

**Solutions**:
1. Verify timestamp is in milliseconds (not seconds)
2. Check environment parameter ('development' vs 'production')
3. Confirm epoch zero matches expectation
4. Use `getEpochStartTime()` and `getEpochEndTime()` to debug boundaries

## Examples

### Complete Content Generation Flow

```typescript
import { getCurrentEpoch, getEpochEndTime, aiConfig } from '@/config/ai-config';
import type { GameAIContent } from '@/types/personalities';

async function getOrGenerateContent(): Promise<GameAIContent> {
  // 1. Calculate current epoch
  const epoch = getCurrentEpoch();
  const environment = import.meta.env.PROD ? 'production' : 'development';
  
  // 2. Check cache
  const cacheKey = `ai-content-${environment}-epoch-${epoch}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // 3. Generate new content
  const content: GameAIContent = {
    version: '1.0.0',
    epoch,
    generatedAt: Date.now(),
    environment,
    vendors: await generateVendors(aiConfig.contentVariation.variantsPerType),
    mascots: await generateMascots(aiConfig.contentVariation.variantsPerType),
    announcers: await generateAnnouncers(aiConfig.contentVariation.variantsPerType),
    metadata: {
      totalItems: 0, // Calculate based on generated content
      totalCost: 0,  // Sum of all generation costs
      totalTokens: 0,
      generationTime: 0,
      status: 'complete'
    }
  };
  
  // 4. Cache until end of epoch
  await cache.set(cacheKey, content, {
    expiresAt: getEpochEndTime(epoch, environment)
  });
  
  return content;
}
```

## Related Documentation

- Claude API Documentation: https://docs.anthropic.com/claude/reference/
- Phaser 3 Game Engine: https://phaser.io/
- Repository README: `/apps/stadium-simulator/README.md`
- Game Balance Configuration: `/apps/stadium-simulator/src/config/gameBalance.ts`
