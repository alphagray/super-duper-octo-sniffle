import { StadiumSection } from '../sprites/StadiumSection';
import { SectionConfig, SeatAssignment } from '../types/GameTypes';
import { Fan } from '../sprites/Fan';

/**
 * Manages seat population and assignment for all stadium sections
 */
export class SeatManager {
  private sections: StadiumSection[] = [];
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Store references to all sections
   */
  initializeSections(sections: StadiumSection[]): void {
    this.sections = sections;
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
}
