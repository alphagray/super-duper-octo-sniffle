/**
 * Content Generation Serverless Function
 * 
 * Vercel serverless function that generates AI personality content using Claude API.
 * Implements secure, cost-controlled content generation with caching and rate limiting.
 * 
 * Features:
 * - Rate limiting: 1 request per epoch per IP address
 * - Edge caching: Prevents duplicate generation for same epoch
 * - Cost estimation: Returns token usage and cost in all responses
 * - Comprehensive error handling: Validates all responses before returning
 * - Claude Haiku: Uses cost-efficient model for generation
 * 
 * Local Development:
 * 1. Install Vercel CLI: npm i -g vercel
 * 2. Run: vercel dev
 * 3. Access: http://localhost:3000/api/generate-content
 * 
 * Production:
 * - Add ANTHROPIC_API_KEY in Vercel dashboard
 * - Deploy: vercel --prod
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { VENDOR_ARCHETYPES, MASCOT_ARCHETYPES, ANNOUNCER_CONTEXTS } from './lib/generation-prompts';
import { validateGameAIContent, type ValidationResult } from './lib/content-validator';
import type { GameAIContent, ContentGenerationError } from '../src/types/personalities';

/**
 * Request body interface
 */
interface GenerationRequest {
  /** Epoch number for content generation (prevents duplicate generation) */
  epoch: number;
  /** Environment (development or production) */
  environment?: 'development' | 'production';
  /** Force regeneration even if cached */
  force?: boolean;
}

/**
 * Response body interface
 */
interface GenerationResponse {
  /** Generated content (if successful) */
  content?: GameAIContent;
  /** Whether content was retrieved from cache */
  cached?: boolean;
  /** Cost estimate in cents */
  costEstimate?: number;
  /** Token usage breakdown */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Generation time in milliseconds */
  generationTime?: number;
  /** Validation warnings (non-fatal issues) */
  warnings?: string[];
  /** Error message (if failed) */
  error?: string;
  /** Detailed errors (if validation failed) */
  errors?: string[];
}

/**
 * Rate limiting store (in-memory for serverless function)
 * 
 * Format: Map<ip-epoch, { count, resetTime }>
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Content cache store (in-memory for serverless function)
 * 
 * Format: Map<epoch, GameAIContent>
 * Note: In production, this should use Vercel Edge Config or external cache
 */
const contentCache = new Map<number, GameAIContent>();

// Configuration constants
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds (one per epoch)
const RATE_LIMIT_MAX = 1; // Maximum 1 request per epoch per IP
const TIMEOUT_MS = 30000; // 30 second timeout for API calls (generation takes longer)
const MAX_TOKENS = 4000; // Maximum tokens for Claude response (full content generation)
const CACHE_DURATION = 24 * 60 * 60 * 1000; // Cache for 24 hours

// Claude Haiku pricing (as of 2024)
const HAIKU_COST_PER_1M_INPUT = 0.25; // $0.25 per 1M input tokens
const HAIKU_COST_PER_1M_OUTPUT = 1.25; // $1.25 per 1M output tokens

/**
 * Clean up old cache and rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  
  // Clean rate limit store
  const rateLimitKeysToDelete: string[] = [];
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      rateLimitKeysToDelete.push(key);
    }
  });
  rateLimitKeysToDelete.forEach((key) => rateLimitStore.delete(key));
  
  // Clean content cache (entries older than 24 hours)
  const cacheKeysToDelete: number[] = [];
  contentCache.forEach((value, key) => {
    if (now - value.generatedAt > CACHE_DURATION) {
      cacheKeysToDelete.push(key);
    }
  });
  cacheKeysToDelete.forEach((key) => contentCache.delete(key));
}, RATE_LIMIT_WINDOW);

/**
 * Check rate limit for epoch-based generation
 * 
 * Prevents same IP from generating content for same epoch multiple times.
 */
function checkRateLimit(ip: string, epoch: number): { allowed: boolean; resetIn?: number } {
  const key = `${ip}-${epoch}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // New window - allow request
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (record.count >= RATE_LIMIT_MAX) {
    // Rate limit exceeded - return time until reset
    const resetIn = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, resetIn };
  }

  // Increment counter and allow request
  record.count++;
  return { allowed: true };
}

/**
 * Validate request body
 */
function validateRequest(body: any): body is GenerationRequest {
  if (!body || typeof body !== 'object') return false;
  
  if (typeof body.epoch !== 'number' || body.epoch < 0) return false;
  
  if (body.environment !== undefined) {
    if (!['development', 'production'].includes(body.environment)) return false;
  }
  
  if (body.force !== undefined && typeof body.force !== 'boolean') return false;
  
  return true;
}

/**
 * Calculate cost estimate based on token usage
 */
function calculateCost(promptTokens: number, completionTokens: number): number {
  const inputCost = (promptTokens / 1_000_000) * HAIKU_COST_PER_1M_INPUT;
  const outputCost = (completionTokens / 1_000_000) * HAIKU_COST_PER_1M_OUTPUT;
  return (inputCost + outputCost) * 100; // Convert to cents
}

/**
 * Build comprehensive prompt for content generation
 */
function buildGenerationPrompt(epoch: number, environment: string): string {
  const timestamp = Date.now();
  
  return `You are a creative AI generating personality content for a retro 8-bit stadium wave game (think NBA Jam meets stadium simulator). Generate complete, production-ready personalities.

**CRITICAL**: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Start with { and end with }.

Generate for Epoch ${epoch} in ${environment} environment:

**5 VENDORS** (one for each archetype):
${Object.values(VENDOR_ARCHETYPES).map((v, i) => `${i + 1}. ${v.name}: ${v.description}\n   - Product: ${v.productType}\n   - Traits: ${v.traits.join(', ')}`).join('\n')}

**3 MASCOTS** (one for each archetype):
${Object.values(MASCOT_ARCHETYPES).map((m, i) => `${i + 1}. ${m.name}: ${m.description}\n   - Theme: ${m.theme}\n   - Traits: ${m.traits.join(', ')}`).join('\n')}

**1 ANNOUNCER** with commentary for 7 contexts:
${Object.values(ANNOUNCER_CONTEXTS).map((a, i) => `${i + 1}. ${a.id}: ${a.description}`).join('\n')}

**REQUIREMENTS**:
- All dialogue under 20 words
- 8-bit retro game aesthetic (NBA Jam, arcade energy)
- Funny, memorable, authentic to archetypes
- Appropriate emotions for each context
- Complete metadata with token/cost tracking

**FORMAT** (valid JSON only):
{
  "version": "1.0.0",
  "epoch": ${epoch},
  "generatedAt": ${timestamp},
  "environment": "${environment}",
  "vendors": [
    {
      "id": "grizzled-veteran-${epoch}",
      "name": "Frank 'The Tank' Thompson",
      "description": "30-year vendor veteran who remembers when tickets cost $5",
      "productType": "mixed",
      "traits": [
        {"id": "trait-1", "name": "Cynical", "description": "Seen it all, believes nothing", "intensity": 0.8, "tags": ["personality"]},
        {"id": "trait-2", "name": "Nostalgic", "description": "Constantly references the good old days", "intensity": 0.9, "tags": ["behavior"]},
        {"id": "trait-3", "name": "Secretly Kind", "description": "Cares more than he admits", "intensity": 0.6, "tags": ["hidden"]}
      ],
      "dialogue": [
        {"id": "d1", "text": "Back in my day, waves didn't need no fancy effects.", "context": {"event": "vendorServe"}, "emotion": "neutral", "priority": 50, "cooldown": 5000},
        {"id": "d2", "text": "Another wave? Sure, why not.", "context": {"event": "waveStart"}, "emotion": "sarcastic", "priority": 50, "cooldown": 5000}
      ],
      "movement": {"speed": 40, "pauseDuration": 3000, "sectionPreferences": {"A": 1.2}, "avoidsActiveWave": true},
      "appearance": {"spriteSheet": "vendor-veteran", "animations": ["walk", "serve"], "colorPalette": ["#8B4513", "#F5DEB3"], "scale": 1.0},
      "metadata": {"model": "claude-3-haiku-20240307", "temperature": 0.8, "promptTokens": 0, "completionTokens": 0, "cost": 0, "generatedAt": ${timestamp}, "epoch": ${epoch}, "usageCount": 0}
    }
  ],
  "mascots": [/* 3 mascots with abilities */],
  "announcers": [
    {
      "id": "announcer-main-${epoch}",
      "name": "The Voice",
      "description": "Retro 8-bit stadium announcer",
      "style": "energetic",
      "traits": [/* 3 traits */],
      "commentary": [/* 35+ lines covering all 7 contexts */],
      "catchphrases": [],
      "metadata": {"model": "claude-3-haiku-20240307", "temperature": 0.8, "promptTokens": 0, "completionTokens": 0, "cost": 0, "generatedAt": ${timestamp}, "epoch": ${epoch}, "usageCount": 0}
    }
  ],
  "metadata": {
    "totalItems": 9,
    "totalCost": 0,
    "totalTokens": 0,
    "generationTime": 0,
    "status": "complete",
    "errors": []
  }
}

Generate complete, authentic content. Be creative with names and dialogue. Match the 8-bit retro sports game vibe.`;
}

/**
 * Generate content using Claude API
 */
async function generateContent(epoch: number, environment: string, apiKey: string, apiUrl: string): Promise<GameAIContent> {
  const startTime = Date.now();
  
  // Build prompt
  const prompt = buildGenerationPrompt(epoch, environment);
  
  // Call Claude API with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Claude Haiku for cost efficiency
        max_tokens: MAX_TOKENS,
        temperature: 0.8, // Creative but not too random
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.content[0]?.text || '';
    
    // Extract token usage from response
    const promptTokens = data.usage?.input_tokens || 0;
    const completionTokens = data.usage?.output_tokens || 0;
    
    // Parse JSON response
    let content: GameAIContent;
    try {
      // Remove markdown code blocks if present
      let cleanText = generatedText.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      content = JSON.parse(cleanText);
    } catch (parseError) {
      throw new Error(`Failed to parse generated content as JSON: ${parseError}`);
    }
    
    // Calculate costs and update metadata
    const generationTime = Date.now() - startTime;
    const costPerItem = calculateCost(promptTokens, completionTokens) / (content.vendors.length + content.mascots.length + content.announcers.length);
    
    // Update metadata for each content item
    content.vendors.forEach(vendor => {
      vendor.metadata.model = 'claude-3-haiku-20240307';
      vendor.metadata.promptTokens = Math.floor(promptTokens / (content.vendors.length + content.mascots.length + content.announcers.length));
      vendor.metadata.completionTokens = Math.floor(completionTokens / (content.vendors.length + content.mascots.length + content.announcers.length));
      vendor.metadata.cost = costPerItem;
      vendor.metadata.generatedAt = startTime;
      vendor.metadata.epoch = epoch;
      vendor.metadata.usageCount = 0;
    });
    
    content.mascots.forEach(mascot => {
      mascot.metadata.model = 'claude-3-haiku-20240307';
      mascot.metadata.promptTokens = Math.floor(promptTokens / (content.vendors.length + content.mascots.length + content.announcers.length));
      mascot.metadata.completionTokens = Math.floor(completionTokens / (content.vendors.length + content.mascots.length + content.announcers.length));
      mascot.metadata.cost = costPerItem;
      mascot.metadata.generatedAt = startTime;
      mascot.metadata.epoch = epoch;
      mascot.metadata.usageCount = 0;
    });
    
    content.announcers.forEach(announcer => {
      announcer.metadata.model = 'claude-3-haiku-20240307';
      announcer.metadata.promptTokens = Math.floor(promptTokens / (content.vendors.length + content.mascots.length + content.announcers.length));
      announcer.metadata.completionTokens = Math.floor(completionTokens / (content.vendors.length + content.mascots.length + content.announcers.length));
      announcer.metadata.cost = costPerItem;
      announcer.metadata.generatedAt = startTime;
      announcer.metadata.epoch = epoch;
      announcer.metadata.usageCount = 0;
    });
    
    // Update aggregate metadata
    content.metadata = {
      totalItems: content.vendors.length + content.mascots.length + content.announcers.length,
      totalCost: calculateCost(promptTokens, completionTokens),
      totalTokens: promptTokens + completionTokens,
      generationTime,
      status: 'complete',
      errors: []
    };
    
    return content;
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Check if it's a timeout
    if (error.name === 'AbortError') {
      throw new Error('Content generation timed out');
    }
    
    throw error;
  }
}

/**
 * Serverless function handler
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Content-Type'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate request
  if (!validateRequest(req.body)) {
    return res.status(400).json({ error: 'Invalid request format. Expected: { epoch: number, environment?: string, force?: boolean }' });
  }

  const { epoch, environment = 'production', force = false } = req.body;

  // Get client IP for rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const clientIp = Array.isArray(ip) ? ip[0] : ip;

  // Check rate limit first (even before cache)
  const rateLimitResult = checkRateLimit(clientIp, epoch);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Only 1 generation per epoch per IP address.',
      resetIn: rateLimitResult.resetIn
    });
  }

  // Check cache after rate limit (unless force regeneration)
  if (!force && contentCache.has(epoch)) {
    const cached = contentCache.get(epoch)!;
    return res.status(200).json({
      content: cached,
      cached: true,
      costEstimate: cached.metadata.totalCost,
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: cached.metadata.totalTokens
      },
      generationTime: 0
    });
  }

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const apiUrl = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Generate content
    const content = await generateContent(epoch, environment, apiKey, apiUrl);
    
    // Validate generated content
    const validation = validateGameAIContent(content);
    
    if (!validation.valid) {
      console.error('Content validation failed:', validation.errors);
      return res.status(500).json({
        error: 'Generated content failed validation',
        errors: validation.errors.slice(0, 10) // Return first 10 errors
      });
    }
    
    // Cache the generated content
    contentCache.set(epoch, content);
    
    // Return successful response
    // Aggregate completion tokens from all content items
    const announcerCompletionTokens = Array.isArray(content.announcers)
      ? content.announcers.reduce((sum, a) => sum + (a?.metadata?.completionTokens || 0), 0)
      : 0;
    const vendorCompletionTokens = Array.isArray(content.vendors)
      ? content.vendors.reduce((sum, v) => sum + (v?.metadata?.completionTokens || 0), 0)
      : 0;
    const mascotCompletionTokens = Array.isArray(content.mascots)
      ? content.mascots.reduce((sum, m) => sum + (m?.metadata?.completionTokens || 0), 0)
      : 0;
    const totalCompletionTokens = announcerCompletionTokens + vendorCompletionTokens + mascotCompletionTokens;

    return res.status(200).json({
      content,
      cached: false,
      costEstimate: content.metadata.totalCost,
      tokenUsage: {
        prompt: content.metadata.totalTokens - totalCompletionTokens,
        completion: totalCompletionTokens,
        total: content.metadata.totalTokens
      },
      generationTime: content.metadata.generationTime,
      warnings: validation.warnings.length > 0 ? validation.warnings.slice(0, 5) : undefined
    });

  } catch (error: any) {
    console.error('Content generation error:', error.message);
    
    // Return generic error (don't leak details)
    return res.status(500).json({
      error: 'Failed to generate content',
      message: error.message?.includes('timeout') ? 'Generation timed out, please try again' : undefined
    });
  }
}
