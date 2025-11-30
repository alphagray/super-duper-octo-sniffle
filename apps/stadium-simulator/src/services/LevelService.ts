// LevelService.ts
// Loads level configuration from JSON including grid zones, sections, stairs, and fan population

import type { StadiumSceneConfig, FanDescriptor } from '@/managers/interfaces/ZoneConfig';
import { gameBalance } from '@/config/gameBalance';

// Re-export FanDescriptor as FanData for backward compatibility
export type FanData = FanDescriptor;

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
  gridConfig: StadiumSceneConfig; // Complete grid/zone configuration
  sections: SectionData[];
  vendors: VendorData[];
  stairs: StairData[];
}

export class LevelService {
  /**
   * Load level data from JSON configuration
   * Eventually this will be a backend API call
   */
  static async loadLevel(): Promise<LevelData> {
    try {
      // Fetch the JSON configuration
      // Use relative path from public/ - Vite will resolve it correctly with base path
      const response = await fetch('/stadium-simulator/assets/stadium-grid-config.json');
      if (!response.ok) {
        throw new Error(`Failed to load grid config: ${response.statusText}`);
      }
      
      const stadiumConfig: StadiumSceneConfig = await response.json();
      
      // Group fans by section from stadium config
      const fansBySection = new Map<string, FanData[]>();
      (stadiumConfig.fans || []).forEach(fan => {
        if (!fansBySection.has(fan.sectionId)) {
          fansBySection.set(fan.sectionId, []);
        }
        fansBySection.get(fan.sectionId)!.push(fan);
      });
      
      // Build section data from stadiumConfig with fans from JSON
      const sections: SectionData[] = (stadiumConfig.sections || []).map(section => {
        return {
          id: section.id,
          label: section.label,
          gridTop: section.gridBounds.top,
          gridLeft: section.gridBounds.left,
          gridRight: section.gridBounds.left + section.gridBounds.width - 1,
          gridBottom: section.gridBounds.top + section.gridBounds.height - 1,
          fans: fansBySection.get(section.id) || []
        };
      });
      
      // Build legacy stair data from stadiumConfig
      const stairs: StairData[] = (stadiumConfig.stairs || []).map(stair => ({
        id: stair.id,
        gridLeft: stair.gridBounds.left,
        gridTop: stair.gridBounds.top,
        width: stair.gridBounds.width,
        height: stair.gridBounds.height,
        connectsSections: stair.connectsSections
      }));
      
      // Mock vendors: 2 vendors at fixed grid positions
      const vendors: VendorData[] = [
        { id: 'vendor-1', type: 'drink', gridRow: 20, gridCol: 11 },
        { id: 'vendor-2', type: 'food', gridRow: 20, gridCol: 20 }
      ];
      
      console.log('[LevelService] Loaded stadium config:', stadiumConfig);
      console.log('[LevelService] Stadium config has cellRanges:', !!stadiumConfig.cellRanges, 'count:', stadiumConfig.cellRanges?.length);
      console.log('[LevelService] Stadium config has cells:', !!stadiumConfig.cells, 'count:', stadiumConfig.cells?.length);
      console.log('[LevelService] Generated sections:', sections);
      
      const result = { gridConfig: stadiumConfig, sections, vendors, stairs };
      console.log('[LevelService] Returning result.gridConfig has cellRanges:', !!result.gridConfig.cellRanges);
      
      return result;
      
    } catch (error) {
      console.error('[LevelService] Failed to load level data:', error);
      
      // Fallback to hardcoded data if JSON fails
      return this.loadLevelFallback();
    }
  }
  
  /**
   * Fallback hardcoded level data (original implementation)
   */
  private static async loadLevelFallback(): Promise<LevelData> {
    console.warn('[LevelService] Using fallback hardcoded level data');
    
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
    const sections: SectionData[] = sectionConfigs.map((cfg) => {
      const fans: FanData[] = [];
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 8; col++) {
          const gridRow = 15 + row;
          const gridCol = cfg.left + col;
          fans.push({
            id: `${cfg.id}-${row}-${col}`,
            type: 'normal',
            sectionId: cfg.id,
            row,
            col,
            gridRow,
            gridCol,
            initialStats: {
              happiness: gameBalance.fanStats.initialHappiness,
              thirst: gameBalance.fanStats.initialThirstMin,
              attention: gameBalance.fanStats.initialAttention,
            },
          });
        }
      }
      return {
        id: cfg.id,
        label: cfg.label,
        gridTop: 14,
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
        gridTop: 14,
        width: 2,
        height: 5,
        connectsSections: ['A', 'B']
      },
      {
        id: 'stairs-B-C',
        gridLeft: 20, // Directly after Section B (12-19)
        gridTop: 14,
        width: 2,
        height: 5,
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
    
    // Create a minimal gridConfig for fallback
    const gridConfig: StadiumSceneConfig = {
      gridConfig: {
        rows: 24,
        cols: 32,
        cellSize: 32
      }
    };
    
    return { gridConfig, sections, vendors, stairs };
  }
}
