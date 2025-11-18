/**
 * Usage & Cost Monitoring Endpoint
 * 
 * Admin endpoint that provides real-time usage metrics and cost tracking
 * for the AI system. Returns aggregated data from function invocations.
 * 
 * Security:
 * - Admin-only access (basic auth or API key)
 * - Read-only operations
 * - No sensitive data exposed
 * 
 * Local Development:
 * - Run: vercel dev
 * - Access: http://localhost:3000/api/usage
 * 
 * Production:
 * - Requires ADMIN_API_KEY environment variable
 * - Access: https://your-app.vercel.app/api/usage
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Usage metrics interface
 */
interface UsageMetrics {
  /** Time period covered by metrics */
  period: string;
  /** Timestamp when metrics were generated */
  timestamp: number;
  /** Total API calls across all endpoints */
  totalCalls: number;
  /** Total cost in cents */
  totalCost: number;
  /** Breakdown by endpoint */
  breakdown: {
    generateContent: EndpointMetrics;
    announcer: EndpointMetrics;
  };
  /** Cost breakdown by epoch */
  costByEpoch: EpochCost[];
  /** Rate limiting statistics */
  rateLimit: RateLimitStats;
  /** Cache performance */
  cache: CacheStats;
}

/**
 * Metrics for a specific endpoint
 */
interface EndpointMetrics {
  /** Total calls to this endpoint */
  calls: number;
  /** Total cost for this endpoint (cents) */
  cost: number;
  /** Average latency in milliseconds */
  avgLatency: number;
  /** Error count */
  errors: number;
  /** Success rate (0-1) */
  successRate: number;
}

/**
 * Cost information for an epoch
 */
interface EpochCost {
  /** Epoch number */
  epoch: number;
  /** Epoch start timestamp */
  startTime: number;
  /** Total cost for this epoch (cents) */
  cost: number;
  /** Number of calls in this epoch */
  calls: number;
  /** Unique IPs that generated content */
  uniqueIPs: number;
}

/**
 * Rate limiting statistics
 */
interface RateLimitStats {
  /** Number of rate limit violations */
  violations: number;
  /** Unique IPs that hit rate limits */
  uniqueIPs: number;
  /** Most recent violations */
  recentViolations: Array<{
    ip: string;
    timestamp: number;
    endpoint: string;
  }>;
}

/**
 * Cache performance statistics
 */
interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Number of cached epochs */
  cachedEpochs: number;
}

// In-memory storage for metrics (persists for function lifetime)
// Note: In production, this should be replaced with a proper database
const metricsStore = {
  generateContent: {
    calls: 0,
    totalCost: 0,
    totalLatency: 0,
    errors: 0,
    successCount: 0,
    costByEpoch: new Map<number, number>(),
    callsByEpoch: new Map<number, number>(),
    ipsByEpoch: new Map<number, Set<string>>(),
  },
  announcer: {
    calls: 0,
    totalCost: 0,
    totalLatency: 0,
    errors: 0,
    successCount: 0,
  },
  rateLimit: {
    violations: 0,
    violatingIPs: new Set<string>(),
    recentViolations: [] as Array<{ ip: string; timestamp: number; endpoint: string }>,
  },
  cache: {
    hits: 0,
    misses: 0,
    cachedEpochs: new Set<number>(),
  },
  startTime: Date.now(),
};

/**
 * Verify admin authentication
 * 
 * Checks for ADMIN_API_KEY in environment and validates against request header.
 * In development mode, allows access without authentication for convenience.
 * 
 * @param req - Vercel request object
 * @returns Whether request is authenticated
 */
function verifyAuth(req: VercelRequest): boolean {
  // In development, allow access without auth
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isDevelopment) {
    return true;
  }

  // In production, require admin API key
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.warn('ADMIN_API_KEY not configured - usage endpoint disabled');
    return false;
  }

  // Check authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return false;
  }

  // Support both "Bearer <token>" and raw token formats
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : authHeader;

  return token === adminKey;
}

/**
 * Calculate aggregated usage metrics
 * 
 * Processes raw metrics from metricsStore and returns formatted statistics.
 * 
 * @returns Formatted usage metrics
 */
function calculateMetrics(): UsageMetrics {
  const now = Date.now();
  const periodHours = (now - metricsStore.startTime) / (1000 * 60 * 60);
  
  // Calculate endpoint metrics
  const generateContentMetrics: EndpointMetrics = {
    calls: metricsStore.generateContent.calls,
    cost: metricsStore.generateContent.totalCost,
    avgLatency: metricsStore.generateContent.calls > 0
      ? metricsStore.generateContent.totalLatency / metricsStore.generateContent.calls
      : 0,
    errors: metricsStore.generateContent.errors,
    successRate: metricsStore.generateContent.calls > 0
      ? metricsStore.generateContent.successCount / metricsStore.generateContent.calls
      : 0,
  };

  const announcerMetrics: EndpointMetrics = {
    calls: metricsStore.announcer.calls,
    cost: metricsStore.announcer.totalCost,
    avgLatency: metricsStore.announcer.calls > 0
      ? metricsStore.announcer.totalLatency / metricsStore.announcer.calls
      : 0,
    errors: metricsStore.announcer.errors,
    successRate: metricsStore.announcer.calls > 0
      ? metricsStore.announcer.successCount / metricsStore.announcer.calls
      : 0,
  };

  // Calculate cost by epoch
  const costByEpoch: EpochCost[] = [];
  metricsStore.generateContent.costByEpoch.forEach((cost, epoch) => {
    costByEpoch.push({
      epoch,
      startTime: 0, // TODO: Calculate from epoch
      cost,
      calls: metricsStore.generateContent.callsByEpoch.get(epoch) || 0,
      uniqueIPs: metricsStore.generateContent.ipsByEpoch.get(epoch)?.size || 0,
    });
  });
  costByEpoch.sort((a, b) => b.epoch - a.epoch); // Most recent first

  // Calculate rate limit stats
  const rateLimitStats: RateLimitStats = {
    violations: metricsStore.rateLimit.violations,
    uniqueIPs: metricsStore.rateLimit.violatingIPs.size,
    recentViolations: metricsStore.rateLimit.recentViolations.slice(-10), // Last 10
  };

  // Calculate cache stats
  const cacheStats: CacheStats = {
    hits: metricsStore.cache.hits,
    misses: metricsStore.cache.misses,
    hitRate: metricsStore.cache.hits + metricsStore.cache.misses > 0
      ? metricsStore.cache.hits / (metricsStore.cache.hits + metricsStore.cache.misses)
      : 0,
    cachedEpochs: metricsStore.cache.cachedEpochs.size,
  };

  return {
    period: `Last ${periodHours.toFixed(1)} hours`,
    timestamp: now,
    totalCalls: generateContentMetrics.calls + announcerMetrics.calls,
    totalCost: generateContentMetrics.cost + announcerMetrics.cost,
    breakdown: {
      generateContent: generateContentMetrics,
      announcer: announcerMetrics,
    },
    costByEpoch,
    rateLimit: rateLimitStats,
    cache: cacheStats,
  };
}

/**
 * Record usage metrics (called by other API functions)
 * 
 * This function is exported so other API endpoints can record their usage.
 * In a real implementation, this would write to a database.
 * 
 * @param endpoint - Endpoint name
 * @param metrics - Metrics to record
 */
export function recordUsage(
  endpoint: 'generateContent' | 'announcer',
  metrics: {
    success: boolean;
    latency: number;
    cost?: number;
    epoch?: number;
    ip?: string;
    cached?: boolean;
  }
): void {
  const store = metricsStore[endpoint];
  
  store.calls++;
  store.totalLatency += metrics.latency;
  
  if (metrics.success) {
    store.successCount++;
  } else {
    store.errors++;
  }
  
  if (metrics.cost) {
    store.totalCost += metrics.cost;
  }

  // Record epoch-specific data for generateContent
  if (endpoint === 'generateContent' && metrics.epoch !== undefined) {
    const currentCost = store.costByEpoch.get(metrics.epoch) || 0;
    store.costByEpoch.set(metrics.epoch, currentCost + (metrics.cost || 0));
    
    const currentCalls = store.callsByEpoch.get(metrics.epoch) || 0;
    store.callsByEpoch.set(metrics.epoch, currentCalls + 1);
    
    if (metrics.ip) {
      if (!store.ipsByEpoch.has(metrics.epoch)) {
        store.ipsByEpoch.set(metrics.epoch, new Set());
      }
      store.ipsByEpoch.get(metrics.epoch)!.add(metrics.ip);
    }
  }

  // Record cache hit/miss
  if (metrics.cached !== undefined) {
    if (metrics.cached) {
      metricsStore.cache.hits++;
    } else {
      metricsStore.cache.misses++;
    }
  }

  // Track cached epochs
  if (metrics.cached && metrics.epoch !== undefined) {
    metricsStore.cache.cachedEpochs.add(metrics.epoch);
  }
}

/**
 * Record rate limit violation (called by other API functions)
 * 
 * @param ip - Client IP that violated rate limit
 * @param endpoint - Endpoint that was rate limited
 */
export function recordRateLimitViolation(ip: string, endpoint: string): void {
  metricsStore.rateLimit.violations++;
  metricsStore.rateLimit.violatingIPs.add(ip);
  metricsStore.rateLimit.recentViolations.push({
    ip,
    timestamp: Date.now(),
    endpoint,
  });
  
  // Keep only recent violations (last 100)
  if (metricsStore.rateLimit.recentViolations.length > 100) {
    metricsStore.rateLimit.recentViolations = 
      metricsStore.rateLimit.recentViolations.slice(-100);
  }
}

/**
 * Serverless function handler for usage metrics
 * 
 * GET /api/usage - Returns current usage statistics
 * 
 * Authentication:
 * - Development: No auth required
 * - Production: Requires ADMIN_API_KEY in Authorization header
 * 
 * Example:
 * ```bash
 * curl -H "Authorization: Bearer YOUR_ADMIN_KEY" \
 *   https://your-app.vercel.app/api/usage
 * ```
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  if (!verifyAuth(req)) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Admin authentication required' 
    });
  }

  try {
    // Calculate and return metrics
    const metrics = calculateMetrics();
    
    return res.status(200).json(metrics);
  } catch (error: any) {
    console.error('Usage metrics error:', error.message);
    
    return res.status(500).json({
      error: 'Failed to calculate usage metrics',
      message: error.message,
    });
  }
}
