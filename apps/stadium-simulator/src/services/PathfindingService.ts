import type { GridManager } from '@/managers/GridManager';
import { GridPathfinder, type PathCalculatedEvent } from '@/managers/GridPathfinder';
import type { GridPathCell } from '@/managers/interfaces/VendorTypes';

/**
 * PathfindingService: Generic pathfinding service for any actor
 * Provides a clean API for requesting paths and subscribing to path calculation events
 * Wraps GridPathfinder to decouple actors from implementation details
 */
export class PathfindingService {
  private pathfinder: GridPathfinder;

  constructor(gridManager: GridManager) {
    this.pathfinder = new GridPathfinder(gridManager);
  }

  /**
   * Request a path from start position to end position
   * Returns array of grid cells to traverse, or empty array if no path found
   * 
   * @param fromX - Starting world X coordinate
   * @param fromY - Starting world Y coordinate
   * @param toX - Target world X coordinate
   * @param toY - Target world Y coordinate
   * @returns Array of GridPathCell representing the path, or empty array if no path exists
   */
  public requestPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ): GridPathCell[] {
    return this.pathfinder.findPath(fromX, fromY, toX, toY);
  }

  /**
   * Clear internal pathfinding caches
   * Should be called when the grid layout changes (e.g., zones loaded, obstacles added)
   */
  public clearCache(): void {
    this.pathfinder.clearCache();
  }

  /**
   * Subscribe to pathfinding events
   * Useful for debug rendering, analytics, or monitoring
   * 
   * @param event - Event name ('pathCalculated' or 'cacheCleared')
   * @param callback - Function to call when event fires
   */
  public on(event: 'pathCalculated', callback: (payload: PathCalculatedEvent) => void): void;
  public on(event: 'cacheCleared', callback: (payload: { timestamp: number }) => void): void;
  public on(event: string, callback: Function): void {
    this.pathfinder.on(event, callback);
  }

  /**
   * Unsubscribe from pathfinding events
   * 
   * @param event - Event name
   * @param callback - Function to remove from listeners
   */
  public off(event: string, callback: Function): void {
    this.pathfinder.off(event, callback);
  }
}
