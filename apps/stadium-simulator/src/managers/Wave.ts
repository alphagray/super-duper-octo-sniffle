/**
 * Represents a single wave instance with its origin, path, and results
 */
export type WaveType = 'NORMAL' | 'SUPER' | 'DOUBLE_DOWN';
export type WaveOutcome = 'success' | 'sputter' | 'death';

export interface WaveSectionResult {
  sectionId: string;
  outcome: WaveOutcome;
  participationRate: number;
  columnResults: Array<{
    columnIndex: number;
    participation: number;
    state: 'success' | 'sputter' | 'death';
  }>;
}

export class Wave {
  public readonly id: string;
  public readonly type: WaveType;
  public readonly originSection: string;
  public readonly path: string[];
  public readonly direction: 'left' | 'right'; // Animation direction
  public readonly startTime: number;
  public endTime: number | null = null;
  
  private sectionResults: WaveSectionResult[] = [];
  private completed: boolean = false;

  constructor(
    id: string,
    type: WaveType,
    originSection: string,
    path: string[],
    startTime: number
  ) {
    this.id = id;
    this.type = type;
    this.originSection = originSection;
    this.path = path;
    this.startTime = startTime;
    
    // Determine direction based on path
    // If first section comes alphabetically before last (e.g., A→B→C or B→C), direction is 'right'
    // If first section comes alphabetically after last (e.g., C→B→A or B→A), direction is 'left'
    if (path.length > 1) {
      const firstSection = path[0];
      const lastSection = path[path.length - 1];
      // Compare alphabetically (A < B < C)
      this.direction = firstSection < lastSection ? 'right' : 'left';
    } else {
      this.direction = 'right'; // Default for single-section waves
    }
  }

  /**
   * Get wave length (number of sections in path)
   */
  public get length(): number {
    return this.path.length;
  }

  /**
   * Check if wave was successful (all sections succeeded, sputter counts as success)
   */
  public get isSuccess(): boolean {
    if (!this.completed) return false;
    return this.sectionResults.every(r => r.outcome === 'success' || r.outcome === 'sputter');
  }

  /**
   * Check if wave failed (any section death)
   */
  public get isFailed(): boolean {
    if (!this.completed) return false;
    return this.sectionResults.some(r => r.outcome === 'death');
  }

  /**
   * Add a section result to this wave
   */
  public addSectionResult(result: WaveSectionResult): void {
    this.sectionResults.push(result);
  }

  /**
   * Mark wave as completed
   */
  public complete(endTime: number): void {
    this.completed = true;
    this.endTime = endTime;
  }

  /**
   * Get all section results
   */
  public getResults(): WaveSectionResult[] {
    return [...this.sectionResults];
  }

  /**
   * Calculate score contribution from this wave
   * @param basePointsPerSection Base points awarded per successful section
   */
  public calculateScore(basePointsPerSection: number = 100): number {
    let score = 0;
    for (const result of this.sectionResults) {
      if (result.outcome === 'success' || result.outcome === 'sputter') {
        score += basePointsPerSection;
      }
    }
    return score;
  }

  /**
   * Calculate maximum possible score for this wave
   * @param basePointsPerSection Base points per section
   */
  public getMaxPossibleScore(basePointsPerSection: number = 100): number {
    return this.path.length * basePointsPerSection;
  }

  /**
   * Export wave data as JSON for debugging
   */
  public toJSON() {
    return {
      id: this.id,
      type: this.type,
      originSection: this.originSection,
      path: this.path,
      direction: this.direction,
      startTime: this.startTime,
      endTime: this.endTime,
      completed: this.completed,
      isSuccess: this.isSuccess,
      isFailed: this.isFailed,
      sectionResults: this.sectionResults,
      score: this.calculateScore(),
      maxPossible: this.getMaxPossibleScore(),
    };
  }

  /**
   * Calculate wave path from origin section
   * @param allSections Array of all section IDs (e.g., ['A', 'B', 'C'])
   * @param originSection Section where wave starts
   * @returns Path array moving in longest direction (ties favor left→right)
   */
  public static calculatePath(allSections: string[], originSection: string): string[] {
    const originIndex = allSections.indexOf(originSection);
    if (originIndex === -1) {
      throw new Error(`Origin section "${originSection}" not found in sections array`);
    }

    const leftPath = allSections.slice(0, originIndex + 1).reverse();
    const rightPath = allSections.slice(originIndex);

    // Choose longest path; if equal, favor right (left→right direction)
    if (rightPath.length > leftPath.length) {
      return rightPath;
    } else if (leftPath.length > rightPath.length) {
      return leftPath;
    } else {
      // Equal length - favor right (normal left→right reading order)
      return rightPath;
    }
  }

  /**
   * Get section position weight for wave start probability
   * Favors edges over center sections
   * @param sectionIndex Index of section in array
   * @param totalSections Total number of sections
   * @param weights Optional custom weight mapping from config
   */
  public static getSectionPositionWeight(
    sectionIndex: number,
    totalSections: number,
    weights?: Record<number, number[]>
  ): number {
    if (weights && weights[totalSections]) {
      return weights[totalSections][sectionIndex] || 1.0;
    }

    // Default fallback: edges get higher weight
    const centerIndex = Math.floor(totalSections / 2);
    const distanceFromCenter = Math.abs(sectionIndex - centerIndex);
    
    // Linear scaling: furthest from center = highest weight
    const maxDistance = Math.floor(totalSections / 2);
    return 0.5 + (distanceFromCenter / maxDistance);
  }
}
