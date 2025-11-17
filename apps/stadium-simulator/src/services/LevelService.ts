// LevelService.ts
// Mocks loading a level with 3 sections, each 4x8 seats, each seat with a fan


export interface FanData {
  id: string;
  row: number;
  col: number;
  // Add more fan properties as needed
}

export interface VendorData {
  id: string;
  type: string;
  gridRow: number;
  gridCol: number;
}


export interface SectionData {
  id: string; // 'A', 'B', 'C'
  label: string;
  gridTop: number;
  gridLeft: number;
  gridRight: number;
  gridBottom: number;
  fans: FanData[];
}


export interface LevelData {
  sections: SectionData[];
  vendors: VendorData[];
}

export class LevelService {
  // Simulate async API call
  static async loadLevel(): Promise<LevelData> {
    // Section layout: 3 sections, each 8x4, 1 space between, bottom boundary row 11, left-most at (11,3)
    const sectionConfigs = [
      { id: 'A', label: 'Section A', left: 3 },
      { id: 'B', label: 'Section B', left: 12 },
      { id: 'C', label: 'Section C', left: 21 }
    ];
    const sections: SectionData[] = sectionConfigs.map((cfg, idx) => {
      const fans: FanData[] = [];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
          fans.push({
            id: `${cfg.id}-${row}-${col}`,
            row,
            col
          });
        }
      }
      return {
        id: cfg.id,
        label: cfg.label,
        gridTop: 8,
        gridLeft: cfg.left,
        gridRight: cfg.left + 7,
        gridBottom: 11,
        fans
      };
    });
    // Mock vendors: 2 vendors at fixed grid positions
    const vendors: VendorData[] = [
      { id: 'vendor-1', type: 'drink', gridRow: 7, gridCol: 6 },
      { id: 'vendor-2', type: 'food', gridRow: 7, gridCol: 17 }
    ];
    // Simulate network delay
    await new Promise(res => setTimeout(res, 10));
    return { sections, vendors };
  }
}
