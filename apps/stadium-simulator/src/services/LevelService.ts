// LevelService.ts
// Loads level data from stadium-layout.json and converts to game-ready format

import type { StadiumSceneConfig } from '@/managers/interfaces/ZoneConfig';

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
  zoneConfig: StadiumSceneConfig;
}

export class LevelService {
  /**
   * Load level data from stadium-layout.json
   * Converts JSON config to game-ready LevelData format
   */
  static async loadLevel(): Promise<LevelData> {
    try {
      const response = await fetch('assets/stadium-layout.json');
      if (!response.ok) {
        throw new Error(`Failed to load stadium layout: ${response.statusText}`);
      }
      
      const config: StadiumSceneConfig = await response.json();
      console.log('[LevelService] Loaded stadium configuration from JSON');

      // Reconfigure rowEntry ranges: remove outer edge entries & add interior entries adjacent to stairs
      // Assumptions: seat rows span grid rows 15-18, stair columns at 10-11 and 20-21, we place rowEntry at columns 11 and 20.
      if (Array.isArray(config.cellRanges)) {
        const cellRanges = config.cellRanges as any[];
        const beforeCount = cellRanges.length;
        const filtered = cellRanges.filter(r => r.zoneType !== 'rowEntry');
        config.cellRanges = filtered;
        const removed = beforeCount - filtered.length;
        // Add new interior rowEntry ranges (one per seat row per interior stair edge column)
        const rowEntryRowsTop = 15;
        const rowEntryRowsBottom = 18; // inclusive
        const interiorColumns = [11, 20];
        interiorColumns.forEach(col => {
          (config.cellRanges as any[]).push({
            zoneType: 'rowEntry',
            transitionType: 'rowBoundary',
            startRow: rowEntryRowsTop,
            endRow: rowEntryRowsBottom,
            startCol: col,
            endCol: col
          } as any);
        });
        console.log(`[LevelService] Reconfigured rowEntry ranges: removed ${removed}, added ${interiorColumns.length} columns spanning rows ${rowEntryRowsTop}-${rowEntryRowsBottom}`);
      } else {
        // Initialize if absent and add ranges
        config.cellRanges = [];
        const rowEntryRowsTop = 15;
        const rowEntryRowsBottom = 18;
        [11, 20].forEach(col => {
          config.cellRanges!.push({
            zoneType: 'rowEntry',
            transitionType: 'rowBoundary',
            startRow: rowEntryRowsTop,
            endRow: rowEntryRowsBottom,
            startCol: col,
            endCol: col
          } as any);
        });
        console.log('[LevelService] Initialized cellRanges with interior rowEntry ranges');
      }
      
      // Convert sections to LevelData format
      const sections: SectionData[] = (config.sections || []).map((sectionDesc) => {
        const fans: FanData[] = [];
        
        // Generate fan data for each seat in the section
        for (let row = 0; row < sectionDesc.rowCount; row++) {
          for (let col = 0; col < sectionDesc.seatsPerRow; col++) {
            fans.push({
              id: `${sectionDesc.sectionId}-${row}-${col}`,
              row,
              col
            });
          }
        }
        
        return {
          id: sectionDesc.sectionId,
          label: sectionDesc.label,
          gridTop: sectionDesc.gridBounds.top,
          gridLeft: sectionDesc.gridBounds.left,
          gridRight: sectionDesc.gridBounds.right,
          gridBottom: sectionDesc.gridBounds.bottom,
          fans
        };
      });
      
      // Convert stairs to LevelData format
      const stairs: StairData[] = (config.stairs || []).map((stairDesc) => ({
        id: stairDesc.stairId,
        gridLeft: stairDesc.gridBounds.left,
        gridTop: stairDesc.gridBounds.top,
        width: stairDesc.gridBounds.width,
        height: stairDesc.gridBounds.height,
        connectsSections: stairDesc.connectsSections as [string, string] || ['', '']
      }));
      
      // Vendors are already in correct format
      const vendors: VendorData[] = config.vendors || [];
      
      // Simulate network delay
      await new Promise(res => setTimeout(res, 10));
      
      return { 
        sections, 
        vendors, 
        stairs,
        zoneConfig: config
      };
      
    } catch (error) {
      console.error('[LevelService] Error loading level data:', error);
      console.warn('[LevelService] Falling back to mock data');
      
      // Fallback to original mock data
      return this.loadMockLevel();
    }
  }
  
  /**
   * Fallback mock data if JSON loading fails
   */
  private static async loadMockLevel(): Promise<LevelData> {
    const sectionConfigs = [
      { id: 'A', label: 'Section A', left: 2 },
      { id: 'B', label: 'Section B', left: 12 },
      { id: 'C', label: 'Section C', left: 22 }
    ];
    
    const sections: SectionData[] = sectionConfigs.map((cfg) => {
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
    
    const stairs: StairData[] = [
      {
        id: 'stairs-A-B',
        gridLeft: 10,
        gridTop: 15,
        width: 2,
        height: 4,
        connectsSections: ['A', 'B']
      },
      {
        id: 'stairs-B-C',
        gridLeft: 20,
        gridTop: 15,
        width: 2,
        height: 4,
        connectsSections: ['B', 'C']
      }
    ];
    
    const vendors: VendorData[] = [
      { id: 'vendor-1', type: 'drink', gridRow: 20, gridCol: 11 },
      { id: 'vendor-2', type: 'food', gridRow: 20, gridCol: 20 }
    ];
    
    // Create minimal zone config for fallback
    const zoneConfig: StadiumSceneConfig = {
      version: '1.0',
      gridDimensions: { rows: 24, cols: 32 },
      cellRanges: [],
      cells: [],
      sections: [],
      stairs: [],
      vendors: [],
      fans: []
    };
    
    await new Promise(res => setTimeout(res, 10));
    return { sections, vendors, stairs, zoneConfig };
  }
}
