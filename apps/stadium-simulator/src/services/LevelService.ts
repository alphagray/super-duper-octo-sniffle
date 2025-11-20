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

export interface StairData {
  id: string;
  gridLeft: number;
  gridTop: number;
  width: number; // grid columns, typically 2
  height: number; // grid rows, typically 4
  connectsSections: [string, string]; // e.g., ['A', 'B']
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
  stairs: StairData[];
}

export class LevelService {
  // Simulate async API call
  static async loadLevel(): Promise<LevelData> {
    // Section layout: 3 sections, each 8x4, with stairs directly adjacent
    // Section A: gridLeft 2-9 (8 columns, with left gutter)
    // Stairs A-B: gridLeft 10-11 (2 columns, directly after A)
    // Section B: gridLeft 12-19 (8 columns, directly after stairs)
    // Stairs B-C: gridLeft 20-21 (2 columns, directly after B)
    // Section C: gridLeft 22-29 (8 columns, directly after stairs)
    const sectionConfigs = [
      { id: 'A', label: 'Section A', left: 2 },
      { id: 'B', label: 'Section B', left: 12 },
      { id: 'C', label: 'Section C', left: 22 }
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
        gridTop: 15,
        gridLeft: cfg.left,
        gridRight: cfg.left + 7,
        gridBottom: 18,
        fans
      };
    });
    
    // Mock stairs: 2 stairways connecting sections (abutting section borders)
    const stairs: StairData[] = [
      {
        id: 'stairs-A-B',
        gridLeft: 10,  // Directly after Section A (2-9)
        gridTop: 15,
        width: 2,
        height: 4,
        connectsSections: ['A', 'B']
      },
      {
        id: 'stairs-B-C',
        gridLeft: 20, // Directly after Section B (12-19)
        gridTop: 15,
        width: 2,
        height: 4,
        connectsSections: ['B', 'C']
      }
    ];
    
    // Mock vendors: 2 vendors at fixed grid positions (updated for new layout)
    // Canvas is 1024x768, cellSize is 32 -> grid is 32x24
    // Center of grid: row 12, col 16
    const vendors: VendorData[] = [
      { id: 'vendor-1', type: 'drink', gridRow: 20, gridCol: 11 },  // Center of canvas
      { id: 'vendor-2', type: 'food', gridRow: 20, gridCol: 20 }   // Slightly right of center
    ];
    // Simulate network delay
    await new Promise(res => setTimeout(res, 10));
    return { sections, vendors, stairs };
  }
}
