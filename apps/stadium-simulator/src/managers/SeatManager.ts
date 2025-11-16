import { StadiumSection } from '../sprites/StadiumSection';
import { SectionConfig, SeatAssignment } from '../types/GameTypes';
import { Fan } from '../sprites/Fan';
import type { GridManager } from './GridManager';

/**
 * Manages seat population and assignment for all stadium sections
 * Provides query methods for vendor targeting and pathfinding
 */
export class SeatManager {
  private sections: StadiumSection[] = [];
  private scene: Phaser.Scene;
  private gridManager?: GridManager;

  constructor(scene: Phaser.Scene, gridManager?: GridManager) {
    this.scene = scene;
    this.gridManager = gridManager;
  }

  /**
   * Store references to all sections
   */
  initializeSections(sections: StadiumSection[]): void {
    this.sections = sections;
    
    // Register seats and row walls with grid if available
    if (this.gridManager) {
      this.registerSeatsAndWalls();
    }
  }

  /**
   * Register all seat positions and row boundary walls with GridManager
   */
  private registerSeatsAndWalls(): void {
    if (!this.gridManager) return;

    this.sections.forEach(section => {
      const sectionWorldX = section.x;
      const sectionWorldY = section.y;

      section.getRows().forEach((row, rowIdx) => {
        row.getSeats().forEach((seat, seatIdx) => {
          const seatPos = seat.getPosition();
          const worldX = sectionWorldX + seatPos.x;
          const worldY = sectionWorldY + seatPos.y;

          // Register seat occupant with grid
          this.gridManager!.registerSeat(worldX, worldY, {
            id: `seat-${section['sectionId']}-${rowIdx}-${seatIdx}`,
            type: 'seat',
            metadata: {
              sectionId: section['sectionId'],
              rowIdx,
              seatIdx,
            },
          });
        });

        // Register top wall for each row to enforce row boundaries
        const firstSeat = row.getSeats()[0];
        const lastSeat = row.getSeats()[row.getSeats().length - 1];
        if (firstSeat && lastSeat) {
          const rowY = sectionWorldY + row.y;
          const leftX = sectionWorldX + firstSeat.getPosition().x;
          const rightX = sectionWorldX + lastSeat.getPosition().x;

          // Convert to grid coordinates and register walls
          const leftCell = this.gridManager!.worldToGrid(leftX, rowY);
          const rightCell = this.gridManager!.worldToGrid(rightX, rowY);

          if (leftCell && rightCell) {
            for (let col = leftCell.col; col <= rightCell.col; col++) {
              this.gridManager!.registerWall(leftCell.row, col, 'top', true);
            }
          }
        }
      });

      // Mark stadium boundaries: register walls around section perimeter
      const sectionBounds = {
        left: sectionWorldX - section['sectionWidth'] / 2,
        right: sectionWorldX + section['sectionWidth'] / 2,
        top: sectionWorldY - section['sectionHeight'] / 2,
        bottom: sectionWorldY + section['sectionHeight'] / 2,
      };

      // Register boundary walls for section perimeter
      const topLeftCell = this.gridManager!.worldToGrid(sectionBounds.left, sectionBounds.top);
      const bottomRightCell = this.gridManager!.worldToGrid(sectionBounds.right, sectionBounds.bottom);

      if (topLeftCell && bottomRightCell) {
        // Top boundary
        for (let col = topLeftCell.col; col <= bottomRightCell.col; col++) {
          this.gridManager!.registerWall(topLeftCell.row, col, 'top', true);
        }
        // Bottom boundary
        for (let col = topLeftCell.col; col <= bottomRightCell.col; col++) {
          this.gridManager!.registerWall(bottomRightCell.row, col, 'bottom', true);
        }
        // Left boundary
        for (let row = topLeftCell.row; row <= bottomRightCell.row; row++) {
          this.gridManager!.registerWall(row, topLeftCell.col, 'left', true);
        }
        // Right boundary
        for (let row = topLeftCell.row; row <= bottomRightCell.row; row++) {
          this.gridManager!.registerWall(row, bottomRightCell.col, 'right', true);
        }
      }
    });
  }

  /**
   * Populate all seats in all sections with fans
   */
  populateAllSeats(fanSize: number = 26): void {
    this.sections.forEach(section => {
      section.getRows().forEach(row => {
        row.getSeats().forEach(seat => {
          if (seat.isEmpty()) {
            const pos = seat.getPosition();
            const fan = new Fan(this.scene, pos.x + section.x, pos.y + section.y, fanSize);
            seat.assignFan(fan);
          }
        });
      });
    });
  }

  /**
   * Populate seats from assignment data
   */
  populateFromData(assignments: SeatAssignment[], fanSize: number = 26): void {
    assignments.forEach(assign => {
      const section = this.sections.find(s => s["sectionId"] === assign.sectionId);
      if (!section) return;
      const row = section.getRows()[assign.row];
      if (!row) return;
      const seat = row.getSeats()[assign.seat];
      if (!seat) return;
      if (assign.occupied) {
        const pos = seat.getPosition();
        // Optionally use assign.fanType and assign.fanProperties for future fan customization
        const fan = new Fan(this.scene, pos.x + section.x, pos.y + section.y, fanSize);
        seat.assignFan(fan);
      } else {
        seat.removeFan();
      }
    });
  }

  /**
   * Get number of empty seats in a section
   */
  getEmptySeats(sectionId: string): number {
    const section = this.sections.find(s => s["sectionId"] === sectionId);
    if (!section) return 0;
    return section.getRows().reduce((sum, row) => sum + row.getSeats().filter(seat => seat.isEmpty()).length, 0);
  }

  /**
   * Get occupancy rate (0-1) for a section
   */
  getSectionOccupancy(sectionId: string): number {
    const section = this.sections.find(s => s["sectionId"] === sectionId);
    if (!section) return 0;
    const totalSeats = section.getRows().reduce((sum, row) => sum + row.getSeats().length, 0);
    const occupied = section.getRows().reduce((sum, row) => sum + row.getSeats().filter(seat => !seat.isEmpty()).length, 0);
    return totalSeats === 0 ? 0 : occupied / totalSeats;
  }

  /**
   * Get thirsty fans in a specific section above threshold
   * Used by drink vendors for targeting
   * 
   * @param sectionIdx Section index (0-based)
   * @param thirstThreshold Minimum thirst level to include
   * @returns Array of thirsty fans with their positions
   */
  public getThirstyFansInSection(
    sectionIdx: number,
    thirstThreshold: number
  ): Array<{ fan: Fan; row: number; col: number; seat: any }> {
    const section = this.sections[sectionIdx];
    if (!section) return [];

    const thirstyFans: Array<{ fan: Fan; row: number; col: number; seat: any }> = [];
    const rows = section.getRows();

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const seats = row.getSeats();

      for (let cIdx = 0; cIdx < seats.length; cIdx++) {
        const seat = seats[cIdx];
        if (!seat.isEmpty()) {
          const fan = seat.getFan();
          if (fan && fan.getThirst() > thirstThreshold) {
            thirstyFans.push({ fan, row: rIdx, col: cIdx, seat });
          }
        }
      }
    }

    return thirstyFans;
  }

  /**
   * Get unhappy fan clusters in a section for ranged AoE targeting
   * Future implementation for t-shirt cannon vendors
   * 
   * @param sectionIdx Section index (0-based)
   * @param happinessThreshold Maximum happiness to be considered unhappy
   * @param excludeGrumps Whether to exclude difficult terrain fans
   * @returns Array of fan clusters with center fan and surrounding fans
   */
  public getUnhappyClustersInSection(
    sectionIdx: number,
    happinessThreshold: number,
    excludeGrumps: boolean = true
  ): Array<{ centerFan: Fan; surroundingFans: Fan[]; avgUnhappiness: number; centerRow: number; centerCol: number }> {
    const section = this.sections[sectionIdx];
    if (!section) return [];

    // TODO: Implement clustering algorithm for AoE targeting
    // For now, return empty array as this is for future ranged vendors
    return [];
  }

  /**
   * Get row crowd density (occupancy percentage)
   * Used for pathfinding cost calculations
   * 
   * @param sectionIdx Section index (0-based)
   * @param rowIdx Row index within section
   * @returns Occupancy rate (0-1)
   */
  public getRowCrowdDensity(sectionIdx: number, rowIdx: number): number {
    const section = this.sections[sectionIdx];
    if (!section) return 0;

    const rows = section.getRows();
    if (rowIdx >= rows.length) return 0;

    const row = rows[rowIdx];
    return row.getOccupancyRate();
  }

  /**
   * Get all sections
   * @returns Array of StadiumSection objects
   */
  public getSections(): StadiumSection[] {
    return this.sections;
  }

  /**
   * Get the center world position of a section
   * @param sectionId - Section ID ('A', 'B', 'C')
   * @returns Center position {x, y} or null if section not found
   */
  public getSectionCenterPosition(sectionId: string): { x: number; y: number } | null {
    const section = this.sections.find(s => s['sectionId'] === sectionId);
    if (!section) return null;
    
    return {
      x: section.x,
      y: section.y
    };
  }
}
