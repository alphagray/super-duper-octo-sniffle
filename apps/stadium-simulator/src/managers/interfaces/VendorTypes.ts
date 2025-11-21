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
  | 'movingToSection'  // Moving to section entry point
  | 'scanningInSection'  // At section, scanning for targets
  | 'movingToFan'  // Moving to specific fan
  | 'serving' 
  | 'cooldown' 
  | 'distracted' 
  | 'rangedCharging';

/**
 * Grid-based path cell for A* navigation
 * Represents a single grid cell in a path with world coordinates
 */
export interface GridPathCell {
  /** Grid row index */
  row: number;
  /** Grid column index */
  col: number;
  /** World X coordinate (center of cell) */
  x: number;
  /** World Y coordinate (center of cell) */
  y: number;
  /** Movement cost from previous cell */
  cost: number;
  /** @deprecated Legacy hybrid path node type */
  nodeType?: PathNodeType;
  /** @deprecated Legacy row index (use row) */
  rowIdx?: number;
  /** @deprecated Legacy column index (use col) */
  colIdx?: number;
  /** @deprecated Legacy section index for stadium navigation */
  sectionIdx?: number;
}

/**
 * @deprecated Use GridPathCell instead. PathSegment was for old hybrid navigation.
 */
export type PathSegment = GridPathCell;

/**
 * @deprecated Legacy node type list from HybridPathResolver. Retained for compilation during refactor.
 */
export type PathNodeType = 'corridor' | 'stair' | 'rowEntry' | 'seat' | 'ground';
