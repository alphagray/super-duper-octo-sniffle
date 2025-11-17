import { SceneryActor } from '@/actors/Actor';
import { StadiumSection } from '@/sprites/StadiumSection';
import type { ActorCategory } from '@/actors/interfaces/ActorTypes';
import type { FanData } from '@/services/LevelService';
import { Fan } from '@/sprites/Fan';
import { SeatActor } from '@/sprites/Seat';
import { SectionRowActor } from './SectionRowActor';

/**
 * SectionActor: Primary game logic for a stadium section.
 * Handles seat/fan population from data, provides queries for AI/wave systems.
 * Now owns its sprite (StadiumSection) via composition.
 */
export class SectionActor extends SceneryActor {
  private section: StadiumSection;
  private sectionId: string;
  private rowActors: SectionRowActor[] = [];
  private fans: Map<string, Fan> = new Map();
  private gridManager?: any;
  private sectionData: any;
  private labelText?: Phaser.GameObjects.Text;
  private happinessAgg: number = 0;
  private thirstAgg: number = 0;
  private attentionAgg: number = 0;

  constructor(
    id: string,
    scene: Phaser.Scene,
    sectionData: any, // Should be SectionData
    gridManager?: any,
    category: ActorCategory = 'section',
    enableLogging = false
  ) {
    super(id, 'section', category, sectionData.gridTop, sectionData.gridLeft, enableLogging);
    this.sectionId = sectionData.id;
    this.gridManager = gridManager;
    this.sectionData = sectionData;
    // Calculate world position from grid boundaries
    // Section container is centered, so calculate center point of grid rectangle
    const topLeft = gridManager ? gridManager.gridToWorld(sectionData.gridTop, sectionData.gridLeft) : { x: 0, y: 0 };
    const bottomRight = gridManager ? gridManager.gridToWorld(sectionData.gridBottom, sectionData.gridRight) : { x: 256, y: 200 };
    const worldPos = {
      x: (topLeft.x + bottomRight.x) / 2,
      y: (topLeft.y + bottomRight.y) / 2
    };
    const rowCount = sectionData.gridBottom - sectionData.gridTop + 1;
    const seatsPerRow = sectionData.gridRight - sectionData.gridLeft + 1;
    const cellSize = gridManager ? gridManager.getWorldSize().cellSize : 32;
    const sectionWidth = seatsPerRow * cellSize;
    const sectionHeight = rowCount * cellSize;
    this.section = new StadiumSection(scene, worldPos.x, worldPos.y, {
      width: sectionWidth,
      height: sectionHeight,
      rowCount,
      seatsPerRow,
      rowBaseHeightPercent: 0.15,
      startLightness: 62,
      autoPopulate: false,
    }, sectionData.id);
    this.sprite = this.section;
    // Create label using grid boundaries and label from data
    if (gridManager) {
      const topLeft = gridManager.gridToWorld(sectionData.gridTop, sectionData.gridLeft);
      const topRight = gridManager.gridToWorld(sectionData.gridTop, sectionData.gridRight);
      const labelX = (topLeft.x + topRight.x) / 2;
      const labelY = topLeft.y - 96;
      this.labelText = scene.add.text(labelX, labelY, sectionData.label, {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
      }).setOrigin(0.5, 0.5);
      // Register section with grid
      gridManager.addOccupant(sectionData.gridTop, sectionData.gridLeft, {
        id: this.id,
        type: 'section',
        metadata: { sectionId: sectionData.id }
      });
    }
    this.logger.debug(`SectionActor created for section ${sectionData.id}`);
  }

  /**
   * Populate seats and fans from level data (data-driven)
   */
  public populateFromData(fanData: FanData[]): void {
    const rowCount = this.sectionData.gridBottom - this.sectionData.gridTop + 1;
    const seatsPerRow = this.sectionData.gridRight - this.sectionData.gridLeft + 1;
    const cellSize = this.gridManager ? this.gridManager.getWorldSize().cellSize : 32;
    const sectionWidth = seatsPerRow * cellSize;
    const sectionHeight = rowCount * cellSize;
    const baseRowHeight = Math.floor(sectionHeight / rowCount);
    const remainder = sectionHeight - baseRowHeight * rowCount;
    const startLightness = 62;
    const maxLightness = 90;
    const minLightness = 30;
    const interval = (maxLightness - startLightness) / Math.max(1, rowCount - 1);

    for (let row = 0; row < rowCount; row++) {
      const gridRow = this.sectionData.gridTop + row;
      const rowHeight = baseRowHeight + (row === 0 ? remainder : 0);
      const targetLightness = Math.max(minLightness, Math.min(maxLightness, startLightness + interval * row));
      const nextRowLightness = Math.max(minLightness, Math.min(maxLightness, startLightness + interval * (row + 1)));

      const rowActor = new SectionRowActor({
        id: `${this.sectionId}-row-${row}`,
        sectionId: this.sectionId,
        rowIndex: row,
        gridTop: gridRow,
        gridLeft: this.sectionData.gridLeft,
        gridRight: this.sectionData.gridRight,
        rowHeightPx: rowHeight,
        rowWidthPx: sectionWidth,
        lightnessStops: { current: targetLightness, next: nextRowLightness },
        container: this.section,
        scene: this.section.scene,
        gridManager: this.gridManager
      });

      rowActor.buildSeats(seatsPerRow);
      this.rowActors.push(rowActor);

      // Inject seats into StadiumSection's row stub for backward compatibility
      if (this.section.getRows()[row]) {
        this.section.getRows()[row].seats = rowActor.getSeats();
      }
    }

    // Create fans from data
    fanData.forEach(fd => {
      const rowActor = this.rowActors[fd.row];
      if (rowActor) {
        const seat = rowActor.getSeatAt(fd.col);
        if (seat) {
          // Create fan sprite at seat position
          // gridToWorld returns center of cell, but fan origin is at bottom (y=0)
          // so we need to shift Y down by half cellSize to bottom-align the fan
          const worldPos = this.gridManager
            ? this.gridManager.gridToWorld(this.sectionData.gridTop + fd.row, this.sectionData.gridLeft + fd.col)
            : { x: 0, y: 0 };
          const cellSize = this.gridManager ? this.gridManager.getWorldSize().cellSize : 32;
          const seatOffsetY = 5; // Offset to align with top of row floor divider (matches SectionRow seat positioning)
          const fanY = worldPos.y + cellSize / 2 - seatOffsetY; // Shift down to bottom of cell, then up by seat offset
          const fan = new Fan(this.section.scene, worldPos.x, fanY);
          seat.setFan(fan);
          this.fans.set(`${fd.row}-${fd.col}`, fan);
        }
      }
    });

    this.logger.debug(`Section ${this.sectionId} populated with ${this.fans.size} fans across ${rowCount} rows`);
  }

  /**
   * Get all fans in this section
   */
  public getFans(): Fan[] {
    return Array.from(this.fans.values());
  }

  /**
   * Query fans by criteria (e.g., thirstiest for AI targeting)
   */
  public queryFans(filter: (fan: Fan) => boolean): Fan[] {
    return this.getFans().filter(filter);
  }

  /**
   * Get fan at specific seat position
   */
  public getFanAt(row: number, col: number): Fan | undefined {
    return this.fans.get(`${row}-${col}`);
  }

  /**
   * Get wrapped StadiumSection sprite.
   */
  public getSection(): StadiumSection {
    return this.section;
  }

  /**
   * Get section identifier (A, B, C).
   */
  public getSectionId(): string {
    return this.sectionId;
  }

  /**
   * Get all row actors in this section.
   */
  public getRowActors(): SectionRowActor[] {
    return this.rowActors;
  }

  /**
   * Get section data (grid bounds, etc).
   */
  public getSectionData(): any {
    return this.sectionData;
  }

  /**
   * Get section stats for registry snapshot.
   */
  public getStats() {
    const worldPos = this.gridManager 
      ? this.gridManager.gridToWorld(this.gridRow, this.gridCol)
      : { x: 0, y: 0 };
    return {
      sectionId: this.sectionId,
      gridPosition: { row: this.gridRow, col: this.gridCol },
      worldPosition: worldPos,
      fanCount: this.fans.size
    };
  }
}
