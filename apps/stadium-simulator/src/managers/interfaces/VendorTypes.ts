/**
 * Vendor type identifier
 */
export type VendorType = 'drink' | 'rangedAoE';

/**
 * Vendor quality tier
 */
export type VendorQualityTier = 'excellent' | 'good' | 'average' | 'poor';

/**
 * Vendor abilities and capabilities
 */
export interface VendorAbilities {
  /** Can ignore base row movement penalty */
  ignoreRowPenalty: boolean;
  /** Can ignore grump/difficult terrain penalty */
  ignoreGrumpPenalty: boolean;
  /** Can enter section rows (vs corridor-only) */
  canEnterRows: boolean;
  /** Ranged service only (no direct approach) */
  rangedOnly: boolean;
}

/**
 * Movement penalty configuration (optional per-vendor overrides)
 */
export interface VendorMovementPenalties {
  rowBasePenalty: number;
  occupiedSeatPenalty: number;
  grumpPenaltyMultiplier: number;
}

/**
 * Vendor profile defining type, quality, and capabilities
 */
export interface VendorProfile {
  /** Unique vendor identifier */
  id: number;
  /** Vendor type (drink, rangedAoE, etc.) */
  type: VendorType;
  /** Quality tier affecting efficiency and behavior */
  qualityTier: VendorQualityTier;
  /** Vendor-specific abilities and flags */
  abilities: VendorAbilities;
  /** Custom AoE radius (for ranged vendors) */
  aoeRadius?: number;
  /** Custom penalty overrides */
  customPenalties?: Partial<VendorMovementPenalties>;
}

/**
 * Vendor state machine states
 */
export type VendorState = 
  | 'idle' 
  | 'planning' 
  | 'movingSegment' 
  | 'serving' 
  | 'cooldown' 
  | 'distracted' 
  | 'rangedCharging';

/**
 * Path segment node type
 */
export type PathNodeType = 'corridor' | 'stair' | 'rowEntry' | 'seat';

/**
 * Path segment for vendor navigation
 */
export interface PathSegment {
  /** Type of navigation node */
  nodeType: PathNodeType;
  /** Section index this segment belongs to */
  sectionIdx: number;
  /** Row index (if applicable) */
  rowIdx?: number;
  /** Column index (if applicable) */
  colIdx?: number;
  /** World X coordinate */
  x: number;
  /** World Y coordinate */
  y: number;
  /** Calculated movement cost for this segment */
  cost: number;
}
