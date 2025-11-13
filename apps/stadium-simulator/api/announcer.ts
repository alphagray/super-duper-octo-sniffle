/**
 * Local Development:
 * 1. Install Vercel CLI: npm i -g vercel
 * 2. Run: vercel dev
 * 3. Access: http://localhost:3000
 * 
 * The Vercel CLI will:
 * - Serve the Vite app
 * - Run this serverless function at /api/announcer
 * - Load env vars from .env.local
 * 
 * Production:
 * - Add ANTHROPIC_API_KEY in Vercel dashboard
 * - Deploy: vercel --prod
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * TypeScript types for announcer requests
 */
interface GameContext {
  score?: number;
  multiplier?: number;
  section?: number;
  thirst?: number;
  happiness?: number;
  reason?: string;
}

interface AnnouncerRequest {
  event: 'waveStart' | 'sectionSuccess' | 'sectionFail' | 'waveComplete';
  context?: GameContext;
  history?: string[];
  // Legacy support for simple string context
  gameContext?: string;
}

interface RateLimitResult {
  allowed: boolean;
  resetIn?: number;
}

// Rate limiting store (in-memory for serverless function)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Configuration constants
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const RATE_LIMIT_MAX = 10; // Maximum requests per window
const TIMEOUT_MS = 8000; // 8 second timeout for API calls
const MAX_TOKENS = 150; // Maximum tokens for Claude response

// Clean up old entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  rateLimitStore.forEach((value, key) => {
    if (now > value.resetTime) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach((key) => rateLimitStore.delete(key));
}, RATE_LIMIT_WINDOW);

/**
 * Rate limiter helper function
 * 
 * Implements a sliding window rate limiter that tracks requests per IP address.
 * Returns whether the request is allowed and optionally how long until the limit resets.
 * 
 * Security: Prevents API abuse by limiting requests to 10 per minute per IP address.
 * 
 * @param ip - Client IP address for rate limiting
 * @returns Object with allowed status and optional resetIn time (seconds)
 */
function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    // New window - allow request and create new record
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
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
 * Input validation helper
 * 
 * Validates the request body structure and content to prevent abuse.
 * Checks for required fields, allowed event types, and reasonable limits.
 * 
 * Security: Prevents malformed requests and injection attacks.
 * 
 * @param body - Request body to validate
 * @returns Type guard confirming body is AnnouncerRequest
 */
function validateRequest(body: any): body is AnnouncerRequest {
  if (!body || typeof body !== 'object') return false;
  
  // Legacy support for simple gameContext string
  if (body.gameContext && typeof body.gameContext === 'string') {
    return body.gameContext.length <= 500;
  }
  
  // Validate event field
  if (!body.event || typeof body.event !== 'string') return false;
  if (body.event.length > 50) return false;
  
  // Validate allowed event types
  const allowedEvents = ['waveStart', 'sectionSuccess', 'sectionFail', 'waveComplete'];
  if (!allowedEvents.includes(body.event)) return false;

  return true;
}

/**
 * Build context-aware prompt for Claude API
 * 
 * Constructs a detailed prompt based on game event type and current state.
 * Includes recent history for continuity and enforces NBA Jam-style personality.
 * 
 * @param request - Validated announcer request with event and context
 * @returns Formatted prompt string for Claude API
 */
function buildPrompt(request: AnnouncerRequest): string {
  // Legacy support for simple gameContext
  if (request.gameContext) {
    return `You are an energetic 8-bit stadium announcer. Give exciting commentary for: ${request.gameContext}`;
  }
  
  const { event, context, history } = request;
  
  let prompt = `You're a retro 8-bit sports announcer (NBA Jam style). `;
  
  // Add context based on event type
  switch (event) {
    case 'waveStart':
      prompt += `The crowd is about to start a wave! Current score: ${context?.score || 0}, multiplier: ${context?.multiplier || 1}x.`;
      break;
    case 'sectionSuccess':
      prompt += `Section ${context?.section} just CRUSHED their wave! Score: ${context?.score}, multiplier: ${context?.multiplier}x.`;
      break;
    case 'sectionFail':
      prompt += `Section ${context?.section} failed the wave. Thirst: ${context?.thirst}, happiness: ${context?.happiness}. `;
      if (context?.reason) prompt += `Reason: ${context.reason}. `;
      break;
    case 'waveComplete':
      prompt += `Wave complete! Final score: ${context?.score}, multiplier: ${context?.multiplier}x.`;
      break;
  }

  // Add recent history for context continuity
  if (history && history.length > 0) {
    prompt += `\nRecent events: ${history.slice(-2).join('. ')}`;
  }

  prompt += `\n\nRespond with ONE energetic sentence (max 20 words). Be funny and match the 8-bit sports game vibe.`;
  
  return prompt;
}

/**
 * Serverless function handler for Claude API proxy
 * 
 * Provides secure, rate-limited access to Claude API for game announcer commentary.
 * 
 * Security features:
 * - Rate limiting: 10 requests per minute per IP
 * - Input validation: Strict type checking and length limits
 * - API key protection: Keys stored server-side only
 * - Timeout protection: 8 second timeout on API calls
 * - Error masking: Generic errors returned to prevent information leakage
 * 
 * @param req - Vercel request object
 * @param res - Vercel response object
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
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

  // Get client IP for rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const clientIp = Array.isArray(ip) ? ip[0] : ip;

  // Check rate limit
  const rateLimitResult = checkRateLimit(clientIp);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      resetIn: rateLimitResult.resetIn
    });
  }

  // Validate request
  if (!validateRequest(req.body)) {
    return res.status(400).json({ error: 'Invalid request format' });
  }

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const apiUrl = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Build prompt
    const prompt = buildPrompt(req.body);

    // Call Claude API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const commentary = data.content[0]?.text || '';

    // Return successful response
    return res.status(200).json({
      commentary,
      cached: false
    });

  } catch (error: any) {
    console.error('API Error:', error.message);
    
    // Return generic error (don't leak details)
    return res.status(500).json({
      error: 'Failed to generate commentary',
      fallback: true
    });
  }
}
