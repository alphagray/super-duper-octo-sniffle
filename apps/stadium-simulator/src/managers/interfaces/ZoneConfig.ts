/**
 * Zone Configuration Types
 * Defines zone types, transitions, and scene configuration for grid-based stadium layouts
 */

import type { CardinalDirection } from '@/managers/GridManager';

// ============================================================================
// Zone & Transition Types
// ============================================================================

/**
 * Zone types for stadium grid cells
 */
export type ZoneType = 'ground' | 'corridor' | 'seat' | 'rowEntry' | 'stair' | 'sky';

/**
 * Transition types marking special boundary cells
 */
export type TransitionType = 'rowBoundary' | 'stairLanding' | 'corridorEntry';

/**
 * Directional flags for entry/exit control
 */
export type DirectionalFlags = Record<CardinalDirection, boolean>;

// ============================================================================
// Cell Configuration Descriptors
// ============================================================================

/**
 * Individual cell descriptor with optional zone, transition, and directional overrides
 */
export interface CellDescriptor {
  row: number;
  col: number;
  zoneType?: ZoneType;
  transitionType?: TransitionType;
  allowedIncoming?: Partial<DirectionalFlags>;
  allowedOutgoing?: Partial<DirectionalFlags>;
  passable?: boolean;
  terrainPenalty?: number;
}

/**
 * Range-based cell descriptor for efficient zone definition
 * Applies properties to all cells in inclusive range [rowStart..rowEnd] × [colStart..colEnd]
 */
export interface CellRangeDescriptor {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  zoneType: ZoneType;
  transitionType?: TransitionType;
  allowedIncoming?: Partial<DirectionalFlags>;
  allowedOutgoing?: Partial<DirectionalFlags>;
  passable?: boolean;
  terrainPenalty?: number;
}

// ============================================================================
// Section & Stair Descriptors
// ============================================================================

/**
 * Stadium section descriptor (grouping of seat rows)
 */
export interface SectionDescriptor {
  sectionId: string;
  label: string;
  gridBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  rowCount: number;
  seatsPerRow: number;
}

/**
 * Stairway descriptor connecting sections or providing vertical access
 */
export interface StairDescriptor {
  stairId: string;
  gridBounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  connectsSections?: string[];
}

// ============================================================================
// Fan Population Descriptor
// ============================================================================

/**
 * Fan population descriptor for initial scene setup
 */
export interface FanDescriptor {
  sectionId: string;
  rowIdx: number;
  seatIdx: number;
  fanType?: 'normal' | 'grumpy' | 'super';
  initialStats?: {
    happiness?: number;
    thirst?: number;
    attention?: number;
  };
}

// ============================================================================
// Vendor Descriptor
// ============================================================================

/**
 * Vendor descriptor for initial placement
 */
export interface VendorDescriptor {
  id: string;
  type: string;
  gridRow: number;
  gridCol: number;
}

// ============================================================================
// Boundary Cache Entry
// ============================================================================

/**
 * Cached boundary cell for fast access during pathfinding
 */
export interface BoundaryCell {
  row: number;
  col: number;
  transitionType: TransitionType;
  zoneType: ZoneType;
}

// ============================================================================
// Complete Stadium Scene Configuration
// ============================================================================

/**
 * Grid dimension configuration
 */
export interface GridDimensions {
  rows: number;
  cols: number;
}

/**
 * Complete stadium scene configuration
 * Loaded from JSON and distributed to GridManager and game systems
 */
export interface StadiumSceneConfig {
  version: string;
  gridDimensions: GridDimensions;
  cellRanges?: CellRangeDescriptor[];
  cells?: CellDescriptor[];
  sections?: SectionDescriptor[];
  stairs?: StairDescriptor[];
  vendors?: VendorDescriptor[];
  fans?: FanDescriptor[];
}
