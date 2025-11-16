# Content Generation API

## Overview

The `/api/generate-content` endpoint generates AI-powered personality content for the Stadium Simulator game using Claude Haiku. It creates complete vendor, mascot, and announcer personalities with dialogue, abilities, and metadata.

## Endpoint

```
POST /api/generate-content
```

## Request Body

```typescript
{
  "epoch": number,              // Required: Epoch number for content generation
  "environment": string,        // Optional: "development" | "production" (default: "production")
  "force": boolean             // Optional: Force regeneration even if cached (default: false)
}
```

### Example Request

```bash
curl -X POST https://your-app.vercel.app/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{
    "epoch": 1,
    "environment": "production"
  }'
```

## Response

### Success Response (200 OK)

```typescript
{
  "content": GameAIContent,     // Generated personality content
  "cached": boolean,            // Whether content was retrieved from cache
  "costEstimate": number,       // Cost in cents (e.g., 0.15 = $0.0015)
  "tokenUsage": {
    "prompt": number,           // Input tokens used
    "completion": number,       // Output tokens used
    "total": number            // Total tokens used
  },
  "generationTime": number,     // Generation time in milliseconds
  "warnings": string[]          // Optional validation warnings
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "error": "Invalid request format. Expected: { epoch: number, environment?: string, force?: boolean }"
}
```

#### 429 Rate Limited
```json
{
  "error": "Rate limit exceeded. Only 1 generation per epoch per IP address.",
  "resetIn": 3600  // Seconds until rate limit resets
}
```

#### 500 Server Error
```json
{
  "error": "Failed to generate content",
  "message": "Optional error details"
}
```

## Generated Content Structure

The `content` field contains a complete `GameAIContent` object with:

### Vendors (5 personalities)
- **Grizzled Veteran**: Cynical but lovable 30-year veteran
- **Overeager Rookie**: Hyperactive first-timer
- **Zen Snack Master**: Philosophical snack vendor
- **Conspiracy Theorist**: Paranoid but competent
- **Former Athlete**: Ex-pro treating vending as sport

Each vendor includes:
- Unique personality traits
- 8+ contextual dialogue lines
- Movement behavior configuration
- Visual appearance settings
- Metadata with cost tracking

### Mascots (3 personalities)
- **Eternal Optimist**: Impossibly cheerful
- **Tired and Jaded**: Cynical but professional
- **Method Actor**: Treats mascoting as art

Each mascot includes:
- Personality traits
- 8+ dialogue lines
- 3+ special abilities with stat effects
- Appearance configuration
- Metadata

### Announcers (1 set)
- Complete announcer personality with commentary for 7 game contexts:
  - Session start
  - Wave start
  - Section success
  - Section fail
  - Wave complete
  - High score
  - Session end

## Features

### Rate Limiting
- **1 request per epoch per IP address**
- Rate limit window: 1 hour
- Prevents abuse and excessive API costs

### Edge Caching
- Generated content is cached in-memory
- Cache duration: 24 hours
- Different IPs can retrieve cached content for the same epoch
- Use `force: true` to bypass cache

### Cost Tracking
- Uses Claude Haiku for cost efficiency
- Pricing: ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens
- Each generation costs approximately $0.001-0.003
- Cost estimate included in all responses

### Content Validation
- All generated content is validated before returning
- Ensures type safety and required fields
- Validation errors returned with details
- Warnings for non-fatal issues

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Optional
ANTHROPIC_API_URL=https://api.anthropic.com/v1/messages  # Default value
```

### Vercel Configuration

Add in `vercel.json`:
```json
{
  "functions": {
    "api/**/*.ts": {
      "maxDuration": 10
    }
  }
}
```

## Local Development

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Create `.env.local`:
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

3. Run development server:
```bash
vercel dev
# or
npm run dev:full
```

4. Test the endpoint:
```bash
curl -X POST http://localhost:3000/api/generate-content \
  -H "Content-Type: application/json" \
  -d '{"epoch": 1}'
```

## Testing

Run tests:
```bash
npm run test:api
```

Tests cover:
- HTTP method validation
- Request validation
- Rate limiting (per epoch, per IP)
- Content caching
- Cost estimation
- Error handling
- Response format validation

## Security

### API Key Protection
- API keys stored server-side only (environment variables)
- Never exposed to client
- Never included in error messages

### Input Validation
- Strict type checking on all inputs
- Maximum token limits (4000)
- Timeout protection (30 seconds)

### Error Masking
- Generic errors returned to prevent information leakage
- Detailed errors logged server-side only
- No API keys or sensitive data in responses

### Rate Limiting
- Per-epoch, per-IP rate limiting
- Prevents API abuse
- Configurable limits and windows

## Cost Management

### Estimated Costs
- Single generation: ~$0.001-0.003
- Monthly cost for 1000 generations: ~$1-3
- Claude Haiku is 10x cheaper than Claude Opus

### Cost Reduction Strategies
1. **Edge Caching**: Reuse content for same epoch across users
2. **Rate Limiting**: Prevent excessive generation
3. **Validation**: Ensure quality before accepting
4. **Batch Generation**: Generate all content in single API call

## Architecture Notes

### Why Claude Haiku?
- Cost efficient: ~$0.25 per 1M input tokens
- Fast generation: ~10-30 seconds for full content
- Quality: Sufficient for creative content generation
- Reliable: Consistent JSON output

### Why Epoch-Based?
- Natural deduplication boundary
- Predictable cache keys
- Prevents duplicate work
- Aligns with game update cycles

### Why In-Memory Cache?
- Serverless functions are stateless
- Vercel Edge Config alternative for production
- Simple implementation for MVP
- 24-hour TTL sufficient for game updates

## Future Enhancements

1. **Vercel Edge Config**: Replace in-memory cache with persistent storage
2. **Streaming**: Stream content as it generates
3. **Partial Generation**: Generate specific content types on demand
4. **Quality Scoring**: AI-powered content quality assessment
5. **A/B Testing**: Multiple variants per archetype
6. **Personalization**: User-specific content preferences

## Related Files

- `api/generate-content.ts` - Main serverless function
- `api/lib/generation-prompts.ts` - Archetype prompts
- `api/lib/content-validator.ts` - Content validation
- `api/__tests__/generate-content.test.ts` - Test suite
- `src/types/personalities.ts` - TypeScript types
