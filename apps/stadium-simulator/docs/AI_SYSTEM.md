# AI System Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Developer Guide](#developer-guide)
3. [Designer Guide](#designer-guide)
4. [Configuration Reference](#configuration-reference)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)
7. [Cost Analysis](#cost-analysis)
8. [Production Deployment](#production-deployment)

---

## Architecture Overview

The Stadium Simulator's AI system generates dynamic, epoch-based personality content for vendors, mascots, and announcers using Claude AI. The architecture prioritizes cost control, performance, and deterministic content generation.

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         GAME CLIENT                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ AIContentManager │  │ DialogueManager  │  │AnnouncerSystem│ │
│  │   (IndexedDB)    │  │  (Selection)     │  │  (Delivery)   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘ │
│           │                     │                     │         │
│           └─────────────────────┴─────────────────────┘         │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────▼─────────────┐
                    │   Vercel Edge Proxy    │
                    │  (Rate Limiting +      │
                    │   Caching)             │
                    └──────────┬─────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                       │
┌───────▼──────────┐  ┌────────▼────────────┐  ┌─────▼────────┐
│/api/generate-     │  │/api/announcer       │  │/api/usage    │
│content            │  │(Real-time           │  │(Admin        │
│(Content Gen)      │  │Commentary)          │  │Dashboard)    │
└───────┬───────────┘  └────────┬────────────┘  └─────┬────────┘
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Claude API        │
                    │   (Anthropic)       │
                    └─────────────────────┘
```

### Key Features

1. **Epoch-Based Content Rotation**
   - Content changes every 1 hour (dev) or 24 hours (prod)
   - Deterministic: same epoch always generates same content
   - Enables edge caching and cost control

2. **Client-Side Content Management**
   - AIContentManager: Fetches and caches content in IndexedDB
   - DialogueManager: Selects contextually appropriate dialogue
   - AnnouncerSystem: Delivers real-time commentary

3. **Serverless API Functions**
   - `/api/generate-content`: Full personality generation
   - `/api/announcer`: Quick commentary for game events
   - `/api/usage`: Admin dashboard for cost monitoring

4. **Cost Control**
   - Rate limiting: 1 generation per epoch per IP
   - Edge caching: Prevents duplicate generation
   - Budget tracking: Per-session and per-day limits
   - Token estimation: Pre-call cost prediction

---

## Developer Guide

### Adding New Archetypes

Archetypes define the personality templates that Claude uses for content generation. They're defined in `api/lib/generation-prompts.ts`.

#### 1. Define Vendor Archetype

```typescript
export const VENDOR_ARCHETYPES = {
  // ... existing archetypes
  
  'coffee-enthusiast': {
    name: 'Coffee Enthusiast',
    description: 'A passionate barista who treats coffee as an art form',
    productType: 'drinks',
    traits: [
      'passionate',
      'knowledgeable',
      'slightly pretentious'
    ],
    dialogueExamples: [
      'This single-origin brew has notes of chocolate and caramel',
      'Let me guess... you\'re a latte person?'
    ],
    movementStyle: 'methodical',
    personality: 'sophisticated but approachable'
  }
};
```

**Key Properties:**
- `name`: Display name for the archetype
- `description`: Brief personality overview
- `productType`: 'drinks' | 'snacks' | 'merchandise' | 'mixed'
- `traits`: 3-5 personality characteristics
- `dialogueExamples`: Sample lines to guide AI
- `movementStyle`: Behavioral hints for pathfinding
- `personality`: Overall vibe description

#### 2. Define Mascot Archetype

```typescript
export const MASCOT_ARCHETYPES = {
  // ... existing archetypes
  
  'disco-octopus': {
    name: 'Disco Octopus',
    description: 'A groovy octopus who brings the 70s back',
    theme: 'character',
    traits: [
      'groovy',
      'multi-talented',
      'nostalgic'
    ],
    abilityHints: [
      'Can boost multiple sections simultaneously with tentacles',
      'Dance moves create happiness waves'
    ],
    visualStyle: 'retro disco with mirror ball effects'
  }
};
```

**Key Properties:**
- `theme`: 'animal' | 'object' | 'character' | 'abstract' | 'sports'
- `abilityHints`: Suggestions for special abilities
- `visualStyle`: Appearance guidance (currently informational)

#### 3. Define Announcer Context

```typescript
export const ANNOUNCER_CONTEXTS = {
  // ... existing contexts
  
  'vendor-collision': {
    id: 'vendor-collision',
    description: 'A vendor interferes with an active wave',
    eventType: 'sectionFail',
    emotionalTone: 'humorous',
    exampleLines: [
      'And the hot dog guy blocks the wave!',
      'Excuse me, sir, we\'re trying to have a moment here!'
    ],
    priority: 70,
    frequency: 'uncommon'
  }
};
```

**Key Properties:**
- `eventType`: Game event that triggers this context
- `emotionalTone`: Desired emotional response
- `priority`: Higher = more likely to be selected (0-100)
- `frequency`: How often this should appear

### Integrating New Content Types

#### Add to Type Definitions

Edit `src/types/personalities.ts`:

```typescript
export interface GameAIContent {
  // ... existing properties
  
  // New content type
  cheerleaders?: CheerleaderPersonality[];
}

export interface CheerleaderPersonality {
  id: string;
  name: string;
  description: string;
  theme: CheerleaderTheme;
  routines: CheerRoutine[];
  chants: CheerChant[];
  metadata: ContentMetadata;
}
```

#### Update Generation Prompt

Edit `api/generate-content.ts` in `buildGenerationPrompt()`:

```typescript
function buildGenerationPrompt(epoch: number, environment: string): string {
  // ... existing prompt sections
  
  **3 CHEERLEADERS** (one for each theme):
  ${Object.values(CHEERLEADER_ARCHETYPES).map((c, i) => 
    `${i + 1}. ${c.name}: ${c.description}`
  ).join('\n')}
  
  // ... rest of prompt
}
```

#### Update Content Validator

Edit `api/lib/content-validator.ts`:

```typescript
export function validateGameAIContent(content: GameAIContent): ValidationResult {
  // ... existing validations
  
  // Validate cheerleaders
  if (content.cheerleaders) {
    content.cheerleaders.forEach((cheerleader, index) => {
      if (!cheerleader.id) {
        result.errors.push(`Cheerleader ${index} missing id`);
      }
      // ... more validations
    });
  }
}
```

### Testing AI Content

#### Unit Tests

Create test file in `src/__tests__/`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateGameAIContent } from '@/api/lib/content-validator';

describe('Cheerleader Content', () => {
  it('should validate cheerleader structure', () => {
    const mockContent = {
      // ... mock content with cheerleaders
    };
    
    const validation = validateGameAIContent(mockContent);
    expect(validation.valid).toBe(true);
  });
});
```

#### Integration Tests

Test with actual API:

```bash
# 1. Start local dev server
npm run vercel:dev

# 2. Generate content
curl -X POST http://localhost:3000/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{"epoch": 1, "environment": "development"}'

# 3. Verify cheerleaders in response
```

#### Manual Testing

Use DevPanel (Ctrl+Shift+D in dev mode):
1. Toggle panel open
2. Force regenerate content
3. Expand personalities section
4. Verify new content type appears
5. Check quality scores and metadata

---

## Designer Guide

### Writing Effective Archetype Descriptions

Good archetypes create memorable, consistent personalities. Follow these principles:

#### 1. Be Specific, Not Generic

❌ **Bad:**
```typescript
description: 'A friendly vendor who sells snacks'
```

✅ **Good:**
```typescript
description: 'A retired football player who pivoted to nachos after a knee injury—still competitive about everything'
```

**Why:** Specific details give Claude clear personality anchors.

#### 2. Use Vivid Traits

❌ **Bad:**
```typescript
traits: ['nice', 'happy', 'helpful']
```

✅ **Good:**
```typescript
traits: ['overconfident', 'dad-joke-enthusiast', 'secretly-insecure']
```

**Why:** Unique trait combinations create distinctive voices.

#### 3. Provide Dialogue Range

Include variety in dialogue examples:

```typescript
dialogueExamples: [
  'Want nachos? Course you do. Everyone does.',           // cocky
  'My nachos won three stadium awards. Look \'em up.',    // braggy
  'These jalapeños? Grown in my backyard.',               // personal
  'My secret? Love. And also excessive cheese.',          // vulnerable
]
```

**Why:** Shows Claude the personality's range and patterns.

#### 4. Match Theme to Gameplay

Mascot abilities should feel natural:

```typescript
{
  name: 'Thunder the Lightning Bug',
  theme: 'animal',
  abilityHints: [
    'Flash ability illuminates all fans, resetting attention',
    'Electric personality boosts wave speed'
  ]
}
```

**Why:** Thematic consistency improves immersion.

### Prompt Engineering Tips

When editing generation prompts in `api/generate-content.ts`:

#### Structure Your Prompts

```typescript
const prompt = `
ROLE: You are a creative AI generating 8-bit game content.

TASK: Generate 5 vendor personalities with these constraints:
- Under 20 words per dialogue line
- Retro sports game aesthetic (NBA Jam vibes)
- Family-friendly language

FORMAT: Return valid JSON only. No markdown, no explanations.

EXAMPLES:
{
  "vendors": [
    {
      "name": "Hot Dog Harry",
      "dialogue": [...]
    }
  ]
}

NOW GENERATE: ...
`;
```

**Structure:**
1. Role: Who is Claude?
2. Task: What to generate
3. Constraints: Limitations and requirements
4. Format: Expected output structure
5. Examples: Reference patterns
6. Action: Final instruction

#### Use Few-Shot Examples

Show Claude what "good" looks like:

```typescript
GOOD EXAMPLE (concise, memorable):
"Hot dogs! Get 'em while they're hot!"

BAD EXAMPLE (too wordy, boring):
"Hello, would you like to purchase a hot dog from me today?"

NOW GENERATE 5 MORE GOOD EXAMPLES...
```

#### Control Creativity with Temperature

In API calls:

```typescript
{
  model: 'claude-3-haiku-20240307',
  temperature: 0.8,  // 0.0 = deterministic, 1.0 = creative
  // ...
}
```

**Guidelines:**
- 0.0-0.3: Factual, predictable (documentation, data)
- 0.4-0.7: Balanced creativity (most content)
- 0.8-1.0: Maximum creativity (brainstorming, art)

### Content Quality Guidelines

#### Dialogue Best Practices

✅ **Do:**
- Keep under 20 words per line
- Use contractions ('it's', 'you're')
- Include personality quirks
- Vary sentence structure
- Add appropriate punctuation

❌ **Don't:**
- Use offensive language
- Reference real people/brands
- Break 4th wall excessively
- Include code/markup
- Exceed 100 characters

#### Personality Consistency

Each personality should be recognizable across contexts:

```typescript
// Grizzled Veteran vendor in different contexts
dialogues: [
  { event: 'vendorServe',    text: 'Been selling beer for 30 years. You want one or not?' },
  { event: 'waveStart',      text: 'Another wave? Sure, why not.' },
  { event: 'sectionSuccess', text: 'Nice. Real nice. Like the old days.' },
  { event: 'sectionFail',    text: 'Figures. Kids these days can\'t hold a wave.' },
]
```

**Consistency Markers:**
- Cynical tone maintained
- Nostalgic references
- Short, clipped sentences
- Sarcastic edge

---

## Configuration Reference

### AI Config (`src/config/ai-config.ts`)

```typescript
export const aiConfig = {
  // Epoch configuration
  epoch: {
    developmentDuration: 60 * 60 * 1000,      // 1 hour (dev)
    productionDuration: 24 * 60 * 60 * 1000,  // 24 hours (prod)
    epochZero: Date.UTC(2025, 0, 1, 0, 0, 0)  // Jan 1, 2025 UTC
  },
  
  // Cost controls
  cost: {
    enabled: true,                   // Enable cost tracking
    maxCostPerSession: 50,           // 50¢ per game session
    maxCostPerUserPerDay: 200,       // $2.00 per user per day
    estimatedCostPerCall: 5,         // 5¢ per API call estimate
    warningThreshold: 0.8            // Warn at 80% of limit
  },
  
  // Cache settings
  cache: {
    enableIndexedDB: true,           // Use browser cache
    cachePrefix: 'stadium-ai-v1',    // Cache key prefix
    maxAge: 24 * 60 * 60 * 1000,     // 24 hours max age
    compressionEnabled: false         // Compress cached data
  },
  
  // API configuration
  api: {
    baseUrl: '/api',                 // Base API path
    generateEndpoint: '/generate-content',
    announcerEndpoint: '/announcer',
    timeout: 30000,                  // 30 second timeout
    retryAttempts: 2,                // Retry failed requests
    retryDelay: 1000                 // 1 second between retries
  },
  
  // Content preferences
  content: {
    minVendors: 5,                   // Minimum vendors per epoch
    minMascots: 3,                   // Minimum mascots per epoch
    minAnnouncers: 1,                // Minimum announcers per epoch
    dialogueVariety: 'high',         // 'low' | 'medium' | 'high'
    allowFallbackContent: true       // Use static content on failure
  },
  
  // Development options
  dev: {
    logLevel: 'info',                // 'debug' | 'info' | 'warn' | 'error'
    showDevPanel: true,              // Enable DevPanel (Ctrl+Shift+D)
    mockApiResponses: false,         // Use mock data instead of API
    logApiCalls: true,               // Log API requests to console
    validateContent: true            // Validate all generated content
  }
};
```

### Vercel Configuration (`vercel.json`)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev",
  
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ],
  
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "s-maxage=3600, stale-while-revalidate=86400"
        }
      ]
    }
  ]
}
```

**Key Settings:**
- `maxDuration`: 30s for content generation
- `memory`: 1024MB for Claude API responses
- `Cache-Control`: 1 hour cache, 24 hour stale-while-revalidate

### Environment Variables

Required in production (Vercel Dashboard → Settings → Environment Variables):

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Optional
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages
NODE_ENV=production
```

---

## API Reference

### POST /api/generate-content

Generates complete AI content for a given epoch.

#### Request

```typescript
{
  epoch: number;           // Required: Epoch number
  environment?: string;    // Optional: 'development' | 'production'
  force?: boolean;         // Optional: Force regeneration
}
```

#### Response (Success)

```typescript
{
  content: GameAIContent;       // Generated content
  cached: boolean;              // Was content from cache?
  costEstimate: number;         // Cost in cents
  tokenUsage: {
    prompt: number;             // Prompt tokens
    completion: number;         // Completion tokens
    total: number;              // Total tokens
  };
  generationTime: number;       // Time in milliseconds
  warnings?: string[];          // Non-fatal issues
}
```

#### Response (Error)

```typescript
{
  error: string;                // Error message
  errors?: string[];            // Validation errors
  resetIn?: number;             // Rate limit reset time (seconds)
}
```

#### Status Codes

- `200`: Success
- `400`: Invalid request format
- `429`: Rate limit exceeded
- `500`: Server error

#### Rate Limiting

- **Limit:** 1 request per epoch per IP address
- **Window:** 1 hour (dev) or 24 hours (prod)
- **Headers:** None (serverless in-memory store)

#### Caching

- **Client:** IndexedDB cache with 24-hour max age
- **Edge:** Vercel Edge Cache (1 hour fresh, 24 hour stale)
- **Key:** `epoch-${epochNumber}`

#### Example

```bash
curl -X POST https://your-app.vercel.app/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{
    "epoch": 42,
    "environment": "production"
  }'
```

### POST /api/announcer

Real-time announcer commentary for game events.

#### Request

```typescript
{
  event: GameEventType;         // Required: Event type
  context?: GameContext;        // Optional: Game state
  history?: string[];           // Optional: Recent events
}

type GameEventType = 
  | 'waveStart' 
  | 'sectionSuccess' 
  | 'sectionFail' 
  | 'waveComplete';

interface GameContext {
  score?: number;
  multiplier?: number;
  section?: number;
  thirst?: number;
  happiness?: number;
  reason?: string;
}
```

#### Response

```typescript
{
  commentary: string;           // Generated commentary
  cached: boolean;              // Was response cached?
}
```

#### Rate Limiting

- **Limit:** 10 requests per minute per IP
- **Window:** 1 minute rolling window

#### Example

```bash
curl -X POST https://your-app.vercel.app/api/announcer \
  -H "Content-Type: application/json" \
  -d '{
    "event": "sectionSuccess",
    "context": {
      "score": 1500,
      "multiplier": 3,
      "section": 2
    }
  }'
```

### GET /api/usage

Admin dashboard for monitoring API usage and costs (admin only).

#### Response

```typescript
{
  period: string;               // Time period (e.g., "Last 24 hours")
  totalCalls: number;           // Total API calls
  totalCost: number;            // Total cost in cents
  breakdown: {
    generateContent: {
      calls: number;
      cost: number;
      avgLatency: number;
    };
    announcer: {
      calls: number;
      cost: number;
      avgLatency: number;
    };
  };
  costByEpoch: Array<{
    epoch: number;
    cost: number;
    calls: number;
  }>;
  rateLimit: {
    violations: number;
    uniqueIPs: number;
  };
}
```

**Note:** This endpoint is planned but not yet implemented. See [Deployment Checklist](#production-deployment) for implementation details.

---

## Troubleshooting

### Common Issues

#### 1. Content Not Generating

**Symptoms:**
- Fallback content always shown
- DevPanel shows "Error" status
- Console errors about API failures

**Diagnosis:**
```typescript
// Check AI config
import { getCurrentEpoch, getEpochStartTime } from '@/config/ai-config';

console.log('Current Epoch:', getCurrentEpoch());
console.log('Epoch Start:', new Date(getEpochStartTime()));
console.log('Environment:', import.meta.env.PROD ? 'production' : 'development');
```

**Solutions:**
1. **Verify API Key:**
   ```bash
   # Check environment variable
   echo $ANTHROPIC_API_KEY
   
   # Test API key directly
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
   ```

2. **Check Network:**
   - Open DevTools → Network tab
   - Filter for `/api/generate-content`
   - Check response status and body

3. **Clear Cache:**
   ```typescript
   // In browser console
   indexedDB.deleteDatabase('stadium-ai-v1');
   location.reload();
   ```

#### 2. Rate Limiting Issues

**Symptoms:**
- HTTP 429 responses
- "Rate limit exceeded" errors
- Can't generate content even after epoch change

**Solutions:**
1. **Check Rate Limit Window:**
   ```typescript
   // In /api/generate-content
   const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
   ```

2. **Wait for Reset:**
   - Error response includes `resetIn` (seconds until reset)
   - Or wait for next epoch

3. **Use Force Parameter (Dev Only):**
   ```typescript
   // Force regeneration (bypasses cache, not rate limit)
   await fetch('/api/generate-content', {
     method: 'POST',
     body: JSON.stringify({ 
       epoch: currentEpoch, 
       force: true 
     })
   });
   ```

#### 3. Validation Failures

**Symptoms:**
- Content generated but not cached
- DevPanel shows warnings
- Missing personality fields

**Diagnosis:**
```typescript
// Run validator manually
import { validateGameAIContent } from '@/api/lib/content-validator';

const result = validateGameAIContent(content);
console.log('Valid:', result.valid);
console.log('Errors:', result.errors);
console.log('Warnings:', result.warnings);
```

**Solutions:**
1. **Check Content Structure:**
   - Verify all required fields present
   - Match types in `src/types/personalities.ts`

2. **Update Validator:**
   - Edit `api/lib/content-validator.ts`
   - Add/remove validation rules as needed

3. **Review Generation Prompt:**
   - Ensure prompt clearly specifies required fields
   - Provide examples of valid structure

#### 4. IndexedDB Errors

**Symptoms:**
- Content refetched every page load
- "QuotaExceededError" in console
- Safari private mode issues

**Solutions:**
1. **Check Storage Quota:**
   ```typescript
   if ('storage' in navigator && 'estimate' in navigator.storage) {
     const estimate = await navigator.storage.estimate();
     console.log('Used:', estimate.usage);
     console.log('Quota:', estimate.quota);
   }
   ```

2. **Clear Old Data:**
   ```typescript
   // In AIContentManager
   async clearOldCache() {
     const db = await this.openDB();
     const tx = db.transaction('content', 'readwrite');
     const store = tx.objectStore('content');
     
     const now = Date.now();
     const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
     
     const allKeys = await store.getAllKeys();
     for (const key of allKeys) {
       const item = await store.get(key);
       if (now - item.timestamp > maxAge) {
         await store.delete(key);
       }
     }
   }
   ```

3. **Fallback to sessionStorage:**
   ```typescript
   // If IndexedDB unavailable
   if (!this.cache.enableIndexedDB) {
     sessionStorage.setItem(cacheKey, JSON.stringify(content));
   }
   ```

### Debug Checklist

When troubleshooting, work through this checklist:

- [ ] Verify `ANTHROPIC_API_KEY` is set and valid
- [ ] Check console for error messages
- [ ] Inspect Network tab for failed API calls
- [ ] Open DevPanel (Ctrl+Shift+D) and check status
- [ ] Verify current epoch matches expected value
- [ ] Check IndexedDB contains cached content
- [ ] Test API endpoint directly with curl
- [ ] Review Vercel function logs (if deployed)
- [ ] Validate environment variables in Vercel dashboard
- [ ] Check rate limit status and reset time

---

## Cost Analysis

### Pricing Breakdown

**Claude Haiku Pricing (as of 2024):**
- Input: $0.25 per 1M tokens
- Output: $1.25 per 1M tokens

### Cost Per Content Generation

**Typical Full Generation:**
```
Prompt: ~2,500 tokens (archetypes + examples)
Output: ~3,500 tokens (5 vendors + 3 mascots + 1 announcer)

Cost = (2,500 * $0.25 / 1M) + (3,500 * $1.25 / 1M)
     = $0.000625 + $0.004375
     = $0.005 = 0.5¢
```

**Announcer Commentary:**
```
Prompt: ~150 tokens
Output: ~30 tokens

Cost = (150 * $0.25 / 1M) + (30 * $1.25 / 1M)
     = $0.0000375 + $0.0000375
     = 0.0000750 = 0.0075¢
```

### Monthly Cost Projections

**Scenario: Small Game (100 daily players)**

| Metric | Value | Cost |
|--------|-------|------|
| Players/day | 100 | |
| Sessions/player | 2 | |
| Epochs/day | 24 (1/hr) | |
| Generations/epoch | 1 | 0.5¢ |
| Announcer calls/session | 50 | 0.0075¢ each |
| **Daily Content Generation** | 24 | **$0.12** |
| **Daily Announcer Calls** | 10,000 | **$0.75** |
| **Daily Total** | | **$0.87** |
| **Monthly Total** | | **~$26** |

**Scenario: Medium Game (1,000 daily players)**

| Metric | Value | Cost |
|--------|-------|------|
| Players/day | 1,000 | |
| Sessions/player | 2 | |
| Epochs/day | 24 | |
| Generations/epoch | 1 | 0.5¢ |
| Announcer calls/session | 50 | 0.0075¢ each |
| **Daily Content Generation** | 24 | **$0.12** |
| **Daily Announcer Calls** | 100,000 | **$7.50** |
| **Daily Total** | | **$7.62** |
| **Monthly Total** | | **~$229** |

**Scenario: Large Game (10,000 daily players)**

| Metric | Value | Cost |
|--------|-------|------|
| Players/day | 10,000 | |
| Sessions/player | 2 | |
| Epochs/day | 24 | |
| Generations/epoch | 1 | 0.5¢ |
| Announcer calls/session | 50 | 0.0075¢ each |
| **Daily Content Generation** | 24 | **$0.12** |
| **Daily Announcer Calls** | 1,000,000 | **$75** |
| **Daily Total** | | **$75.12** |
| **Monthly Total** | | **~$2,254** |

### Cost Optimization Strategies

#### 1. Cache Aggressively

```typescript
// Current: 24-hour edge cache
headers: [
  {
    "source": "/api/(.*)",
    "headers": [
      {
        "key": "Cache-Control",
        "value": "s-maxage=3600, stale-while-revalidate=86400"
      }
    ]
  }
]

// Optimization: Longer cache for generate-content
{
  "source": "/api/generate-content",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "s-maxage=86400, stale-while-revalidate=604800"
    }
  ]
}
```

**Savings:** ~50% reduction in content generation calls

#### 2. Reduce Announcer Calls

```typescript
// Current: Call API for every announcement
async getCommentary(event: GameEventType) {
  return await fetch('/api/announcer', {...});
}

// Optimization: Use cached personality content
async getCommentary(event: GameEventType) {
  const content = await this.contentManager.getContent();
  const announcer = content.announcers[0];
  
  // Select from pre-generated commentary
  const matching = announcer.commentary.filter(
    line => line.context.event === event
  );
  
  return matching[Math.floor(Math.random() * matching.length)].text;
}
```

**Savings:** ~95% reduction in announcer API calls

#### 3. Batch Content Generation

```typescript
// Instead of per-epoch generation, generate content for multiple epochs
{
  epoch: 42,
  count: 7  // Generate for next 7 epochs
}
```

**Trade-off:** Higher upfront cost, but better caching and reduced API overhead

#### 4. Use Static Fallbacks

```typescript
// Always include high-quality static content
const STATIC_CONTENT = {
  vendors: [...],
  mascots: [...],
  announcers: [...]
};

// Only generate AI content for special epochs
if (epoch % 7 === 0) {  // Every 7th epoch
  return await generateAIContent(epoch);
} else {
  return STATIC_CONTENT;
}
```

**Savings:** ~85% reduction in generation costs

### Budget Monitoring

Implement cost tracking:

```typescript
// In /api/usage endpoint
interface UsageMetrics {
  date: string;
  totalCost: number;
  generateContentCalls: number;
  announcerCalls: number;
  uniqueUsers: number;
  costPerUser: number;
}

// Store in database (e.g., Vercel Postgres)
await db.insert('usage_metrics', {
  date: new Date().toISOString(),
  totalCost: dailyCost,
  generateContentCalls: contentCalls,
  announcerCalls: announcerCalls,
  uniqueUsers: uniqueIPs.size,
  costPerUser: dailyCost / uniqueIPs.size
});
```

Set up alerts:

```typescript
// Alert if daily cost exceeds threshold
const DAILY_COST_THRESHOLD = 10.00; // $10/day

if (dailyCost > DAILY_COST_THRESHOLD) {
  await sendAlert({
    to: 'admin@example.com',
    subject: 'AI Cost Alert',
    body: `Daily AI costs reached $${dailyCost.toFixed(2)}`
  });
}
```

---

## Production Deployment

### Pre-Deployment Checklist

#### 1. Environment Configuration

- [ ] Add `ANTHROPIC_API_KEY` to Vercel environment variables
- [ ] Verify `NODE_ENV=production`
- [ ] Set custom `ANTHROPIC_API_URL` if using proxy
- [ ] Configure domain/subdomain

#### 2. Vercel Configuration

- [ ] Update `vercel.json` with final settings:
  ```json
  {
    "functions": {
      "api/**/*.ts": {
        "maxDuration": 30,
        "memory": 1024
      }
    }
  }
  ```
- [ ] Configure edge caching headers
- [ ] Set up rate limiting (Vercel Edge Config)
- [ ] Enable function analytics

#### 3. Security Audit

- [ ] Run `npm run audit:security`
- [ ] Review API endpoints for vulnerabilities
- [ ] Validate input sanitization
- [ ] Test rate limiting with ab or artillery
- [ ] Verify CORS configuration
- [ ] Check for exposed secrets in logs

#### 4. Performance Testing

- [ ] Load test `/api/generate-content`
  ```bash
  ab -n 100 -c 10 -p request.json -T application/json \
    https://your-app.vercel.app/api/generate-content
  ```
- [ ] Load test `/api/announcer`
- [ ] Verify cache hit rate in Vercel logs
- [ ] Test with slow network conditions
- [ ] Measure Time to Interactive (TTI)

#### 5. Content Validation

- [ ] Generate content for epochs 1-7
- [ ] Manually review all personalities
- [ ] Check for inappropriate content
- [ ] Verify dialogue length (<20 words)
- [ ] Test all archetype combinations
- [ ] Validate JSON structure

#### 6. Monitoring Setup

- [ ] Configure Vercel Analytics
- [ ] Set up error tracking (Sentry/etc)
- [ ] Create usage dashboard
- [ ] Set cost alert thresholds
- [ ] Document incident response plan

### Deployment Steps

#### Initial Deployment

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link to Vercel project
vercel link

# 3. Set environment variables
vercel env add ANTHROPIC_API_KEY

# 4. Deploy to preview
vercel

# 5. Test preview deployment
# Visit provided URL and test all features

# 6. Deploy to production
vercel --prod
```

#### CI/CD Pipeline

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        working-directory: apps/stadium-simulator
      
      - name: Type check
        run: npm run type-check
        working-directory: apps/stadium-simulator
      
      - name: Run tests
        run: npm test
        working-directory: apps/stadium-simulator
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          working-directory: apps/stadium-simulator
```

### Post-Deployment Validation

#### 1. Smoke Tests

Run these immediately after deployment:

```bash
# Test content generation
curl -X POST https://your-app.vercel.app/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{"epoch": 1, "environment": "production"}'

# Test announcer
curl -X POST https://your-app.vercel.app/api/announcer \
  -H "Content-Type: application/json" \
  -d '{"event": "waveStart", "context": {"score": 100}}'

# Test rate limiting
for i in {1..5}; do
  curl -X POST https://your-app.vercel.app/api/generate-content \
    -H "Content-Type: application/json" \
    -d "{\"epoch\": $i}"
  sleep 1
done
```

#### 2. Monitor Metrics

Check Vercel dashboard for:
- Function invocation count
- Average duration (should be <5s for announcer, <15s for content)
- Error rate (should be <1%)
- Cache hit rate (should be >90% after warmup)

#### 3. Cost Tracking

Enable detailed cost tracking:

```typescript
// Add to /api/generate-content
console.log('Cost Log:', {
  epoch,
  promptTokens,
  completionTokens,
  cost: calculateCost(promptTokens, completionTokens),
  timestamp: Date.now()
});
```

Export logs from Vercel:
```bash
vercel logs --project stadium-simulator --since 24h > logs.txt
grep "Cost Log" logs.txt | jq -s 'map(.cost) | add'
```

### Rollback Plan

If deployment fails:

```bash
# 1. Identify last working deployment
vercel ls

# 2. Rollback to previous deployment
vercel rollback <deployment-url>

# 3. Verify rollback
curl https://your-app.vercel.app/api/generate-content
```

### Maintenance

#### Weekly Tasks
- [ ] Review error logs
- [ ] Check cost trends
- [ ] Validate content quality
- [ ] Update archetype prompts if needed

#### Monthly Tasks
- [ ] Analyze usage patterns
- [ ] Optimize caching strategy
- [ ] Review rate limiting effectiveness
- [ ] Update cost projections
- [ ] Security audit

---

## Appendix

### Related Documentation

- [AI_CONFIGURATION.md](./AI_CONFIGURATION.md) - Detailed config reference
- [AI_PERSONALITY_INTEGRATION.md](./AI_PERSONALITY_INTEGRATION.md) - Integration guide
- [API_GENERATE_CONTENT.md](./API_GENERATE_CONTENT.md) - API implementation details
- [CONTENT_GENERATION_GUIDE.md](./CONTENT_GENERATION_GUIDE.md) - Content creation tips
- [UI_COMPONENTS.md](./UI_COMPONENTS.md) - SpeechBubble and DevPanel

### External Resources

- [Claude API Documentation](https://docs.anthropic.com/)
- [Vercel Functions Documentation](https://vercel.com/docs/functions)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Phaser 3 Documentation](https://photonstorm.github.io/phaser3-docs/)

### Version History

- **v1.0.0** (2025-01-01): Initial AI system release
  - Epoch-based content generation
  - Claude Haiku integration
  - Cost tracking and rate limiting
  - IndexedDB caching
  - DevPanel for debugging

---

**Last Updated:** 2025-11-18
**Maintained By:** AI System Team
