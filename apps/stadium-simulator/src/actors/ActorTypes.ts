/**
 * Type definitions for the actor system.
 */

export type ActorCategory = 'fan' | 'vendor' | 'mascot' | 'section' | 'row' | 'seat' | 'wave' | 'waypoint' | 'zone';

export type ActorKind = 'animated' | 'scenery' | 'utility';

/**
 * Snapshot representation of an actor for UI/serialization.
 * Lightweight data transfer object without Phaser dependencies.
 * Position can be either world coords {x,y} or grid coords {row,col}
 */
export interface ActorSnapshot {
  id: string;
  type: string; // 'actor:fan', 'actor:vendor', etc.
  category: ActorCategory;
  kind: ActorKind;
  position?: { x: number; y: number } | { row: number; col: number };
  state?: Record<string, any>; // Custom state data (stats, flags, etc.)
  visible: boolean;
}

/**
 * Filter criteria for querying actors from registry.
 */
export interface ActorQuery {
  category?: ActorCategory;
  kind?: ActorKind;
  ids?: string[];
}
