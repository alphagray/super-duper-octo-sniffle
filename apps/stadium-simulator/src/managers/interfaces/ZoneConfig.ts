import type { CardinalDirection } from '@/managers/GridManager';

/**
 * Zone types for grid cells
 */
export type ZoneType = 'ground' | 'corridor' | 'seat' | 'rowEntry' | 'stair' | 'sky';

/**
 * Transition types for boundary cells
 */
export type TransitionType = 'rowBoundary' | 'stairLanding' | 'corridorEntry';

/**
 * Directional access flags for cell edges
 */
export type DirectionalFlags = Partial<Record<CardinalDirection, boolean>>;

/**
 * Individual cell descriptor
 */
export interface CellDescriptor {
  row: number;
  col: number;
  zoneType: ZoneType;
  transitionType?: TransitionType;
  allowedIncoming?: DirectionalFlags;
  allowedOutgoing?: DirectionalFlags;
  passable?: boolean;
}

/**
 * Contiguous rectangular cell range descriptor
 */
export interface CellRangeDescriptor {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
  zoneType: ZoneType;
  transitionType?: TransitionType;
  allowedIncoming?: DirectionalFlags;
  allowedOutgoing?: DirectionalFlags;
  passable?: boolean;
}

/**
 * Grid bounds for sections and stairs
 */
export interface GridBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Stadium section descriptor
 */
export interface SectionDescriptor {
  id: string;
  label: string;
  gridBounds: GridBounds;
  rows: number;
  seatsPerRow: number;
}

/**
 * Stairway connector descriptor
 */
export interface StairDescriptor {
  id: string;
  gridBounds: GridBounds;
  connectsSections: [string, string];
}

/**
 * Fan type variants
 */
export type FanType = 'normal' | 'grumpy' | 'super';

/**
 * Fan initial stats
 */
export interface FanInitialStats {
  happiness: number;
  thirst: number;
  attention: number;
}

/**
 * Fan occupancy descriptor
 */
export interface FanDescriptor {
  id: string;
  type: string; // 'default', 'grump', etc. - matches FanType but allows extensibility
  sectionId: string;
  row: number; // row within section (0-based)
  col: number; // column within section (0-based)
  gridRow: number; // absolute grid row
  gridCol: number; // absolute grid column
  initialStats: FanInitialStats;
}

/**
 * Grid configuration
 */
export interface GridConfig {
  rows: number;
  cols: number;
  cellSize: number;
}

/**
 * Complete stadium scene configuration
 * Single file containing grid zones, sections, stairs, and fan population
 */
export interface StadiumSceneConfig {
  gridConfig: GridConfig;
  cellRanges?: CellRangeDescriptor[];
  cells?: CellDescriptor[];
  sections?: SectionDescriptor[];
  stairs?: StairDescriptor[];
  fans?: FanDescriptor[];
}

/**
 * Boundary cell reference for quick lookup
 */
export interface BoundaryCell {
  row: number;
  col: number;
  transitionType: TransitionType;
}
