import type { GameState, Section } from '@/types/GameTypes';

/**
 * Manages the game state including sections, wave mechanics, and scoring
 */
export class GameStateManager {
  private sections: Section[];

  constructor() {
    // Initialize 3 sections (A, B, C) with default values
    this.sections = [
      { id: 'A', happiness: 70, thirst: 0, attention: 50 },
      { id: 'B', happiness: 70, thirst: 0, attention: 50 },
      { id: 'C', happiness: 70, thirst: 0, attention: 50 },
    ];
  }

  /**
   * Returns all sections
   */
  public getSections(): Section[] {
    return [...this.sections];
  }

  /**
   * Returns a specific section by id
   * @param id - The section identifier (A, B, or C)
   * @throws Error if section not found
   */
  public getSection(id: string): Section {
    const section = this.sections.find((s) => s.id === id);
    if (!section) {
      throw new Error(`Section ${id} not found`);
    }
    return section;
  }

  /**
   * Calculates the wave success chance for a section
   * Formula: 80 + (happiness * 0.2) - (thirst * 0.3)
   * @param sectionId - The section identifier
   * @returns The success chance as a number (not percentage)
   */
  public calculateWaveSuccess(sectionId: string): number {
    const section = this.getSection(sectionId);
    return 80 + (section.happiness * 0.2) - (section.thirst * 0.3);
  }

  /**
   * Vendor serves a section, decreasing thirst and increasing happiness
   * @param sectionId - The section identifier
   */
  public vendorServe(sectionId: string): void {
    const section = this.getSection(sectionId);
    // Decrease thirst by 30, increase happiness by 10
    section.thirst = this.clamp(section.thirst - 30, 0, 100);
    section.happiness = this.clamp(section.happiness + 10, 0, 100);
  }

  /**
   * Updates all section stats based on time elapsed
   * Happiness decreases 1 per second, thirst increases 2 per second
   * @param deltaTime - Time elapsed in milliseconds
   */
  public updateStats(deltaTime: number): void {
    const seconds = deltaTime / 1000;
    this.sections.forEach((section) => {
      section.happiness = this.clamp(section.happiness - (1 * seconds), 0, 100);
      section.thirst = this.clamp(section.thirst + (2 * seconds), 0, 100);
    });
  }

  /**
   * Updates a specific stat on a specific section
   * @param id - The section identifier
   * @param stat - The stat to update (must be a key of Section excluding 'id')
   * @param value - The new value
   */
  public updateSectionStat(id: string, stat: keyof Section, value: number): void {
    const section = this.getSection(id);
    if (stat !== 'id') {
      (section[stat] as number) = value;
    }
  }

  /**
   * Clamps a value between min and max
   * @param value - The value to clamp
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns The clamped value
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
