/**
 * Grid math utilities for distance calculations and spatial queries
 */

/**
 * Calculate Manhattan distance between two grid cells
 * Manhattan distance is the sum of absolute differences in row and column
 * (also known as taxicab or L1 distance)
 * 
 * @param rowA Row coordinate of first cell
 * @param colA Column coordinate of first cell
 * @param rowB Row coordinate of second cell
 * @param colB Column coordinate of second cell
 * @returns Manhattan distance between the two cells
 */
export function manhattanDistance(
  rowA: number,
  colA: number,
  rowB: number,
  colB: number
): number {
  return Math.abs(rowA - rowB) + Math.abs(colA - colB);
}
