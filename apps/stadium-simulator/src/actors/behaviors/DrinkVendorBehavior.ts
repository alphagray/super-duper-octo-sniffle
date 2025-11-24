import type { AIActorBehavior, AIActorState } from '@/actors/interfaces/AIBehavior';
import type { DrinkVendorActor } from '@/actors/DrinkVendorActor';
import type { AIManager } from '@/managers/AIManager';
import type { GridManager } from '@/managers/GridManager';
import type { ActorRegistry } from '@/actors/base/ActorRegistry';
import type { PathfindingService } from '@/services/PathfindingService';
import type { Fan } from '@/sprites/Fan';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { ZoneType } from '@/managers/interfaces/ZoneConfig';
import { gameBalance } from '@/config/gameBalance';
import { manhattanDistance } from '@/utils/gridMath';

/**
 * DrinkVendorBehavior: Implements AI behavior for drink vendors
 * Handles seat assignment, cluster targeting, retry logic, recall, and patrol
 */
export class DrinkVendorBehavior implements AIActorBehavior {
  private vendorActor: DrinkVendorActor;
  private aiManager: AIManager;
  private gridManager: GridManager;
  private actorRegistry: ActorRegistry;
  private pathfindingService: PathfindingService | null = null;
  
  // Configuration (merged defaults + overrides)
  private config: typeof gameBalance.vendorTypes.drink;
  
  // State machine
  private state: AIActorState = 'idle' as AIActorState;
  
  // Target tracking (direct actor reference)
  private targetFanActor: any | null = null; // FanActor
  private targetPosition: { row: number; col: number; sectionIdx: number } | null = null;
  
  // Assignment tracking (legacy, for section assignment)
  private assignedSectionIdx: number | null = null;
  private retryCount: number = 0;
  
  // Service timing
  private serviceTimer: number = 0;
  private scanTimer: number = 0;
  
  // Patrol tracking
  private patrolTimer: number = 0;
  
  constructor(
    vendorActor: DrinkVendorActor,
    aiManager: AIManager,
    gridManager: GridManager,
    actorRegistry: ActorRegistry,
    pathfindingService?: PathfindingService,
    configOverrides?: Partial<typeof gameBalance.vendorTypes.drink>
  ) {
    this.vendorActor = vendorActor;
    this.aiManager = aiManager;
    this.gridManager = gridManager;
    this.actorRegistry = actorRegistry;
    this.pathfindingService = pathfindingService || null;
    
    // Merge configuration
    this.config = {
      ...gameBalance.vendorTypes.drink,
      ...configOverrides,
    };
    
    console.log('[DrinkVendorBehavior] Created with pathfindingService:', !!this.pathfindingService);
  }

  /**
   * Request assignment to target cell
   */
  public requestAssignment(targetCell: { row: number; col: number }): void {
    this.state = 'assigning' as AIActorState;
    this.retryCount = 0;
    
    // TODO: Implement seat selection and cluster logic
    console.log(`[DrinkVendorBehavior] Assignment requested to (${targetCell.row},${targetCell.col})`);
  }

  /**
   * Select next target fan for drink service
   * @returns Target with fanActor, position, and section index, or null if none found
   */
  public selectTarget(): {
    fanActor: any; // FanActor
    fan: Fan;
    sectionIdx: number;
    rowIdx: number;
    colIdx: number;
    x: number;
    y: number;
  } | null {
    const sectionActors = this.aiManager.getSectionActors();
    const vendorPos = this.vendorActor.getPosition();
    const vendorGridPos = this.vendorActor.getGridPosition();

    const candidates: Array<{
      fanActor: any;
      fan: Fan;
      sectionIdx: number;
      rowIdx: number;
      colIdx: number;
      x: number;
      y: number;
      thirst: number;
    }> = [];

    let totalFans = 0;

    // Scan sections (if assigned, restrict to that section)
    for (let sIdx = 0; sIdx < sectionActors.length; sIdx++) {
      if (this.assignedSectionIdx !== null && this.assignedSectionIdx !== sIdx) {
        continue;
      }

      const sectionActor = sectionActors[sIdx];
      const thirstyFans = sectionActor.queryThirstiestFans(50); // Get top 50 per section

      for (const entry of thirstyFans) {
        totalFans++;
        const worldPos = this.gridManager.gridToWorld(entry.row, entry.col);
        candidates.push({
          fanActor: entry.fanActor,
          fan: entry.fan,
          sectionIdx: sIdx,
          rowIdx: entry.row,
          colIdx: entry.col,
          x: worldPos.x,
          y: worldPos.y,
          thirst: entry.thirst,
        });
      }
    }

    if (candidates.length === 0) {
      return null;
    }

    // Score candidates: distance + thirst weight
    const scoredCandidates = candidates.map(c => {
      const dx = c.x - vendorPos.x;
      const dy = c.y - vendorPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const normalizedDistance = distance / 32; // Divide by cell size
      const thirstPriority = (100 - c.thirst) / 10; // High thirst = low score
      
      return {
        ...c,
        score: normalizedDistance + thirstPriority,
      };
    });

    // Pick best candidate
    scoredCandidates.sort((a, b) => a.score - b.score);
    const best = scoredCandidates[0];

    return {
      fanActor: best.fanActor,
      fan: best.fan,
      sectionIdx: best.sectionIdx,
      rowIdx: best.rowIdx,
      colIdx: best.colIdx,
      x: best.x,
      y: best.y,
    };
  }

  /**
   * Request recall to neutral zone
   */
  public requestRecall(): void {
    this.initiateRecall();
  }

  /**
   * Update behavior each frame
   */
  public tick(deltaTime: number): void {
    switch (this.state) {
      case 'idle':
        this.updateIdle(deltaTime);
        break;
        
      case 'moving':
        // Movement handled by VendorActor.updateMovement()
        // VendorActor will call onArrival() when destination reached
        break;
        
      case 'serving':
        this.updateServing(deltaTime);
        break;
        
      case 'patrolling':
        this.updatePatrol(deltaTime);
        break;
        
      case 'recalling':
        // Movement to neutral zone, onArrival() handles transition
        break;
        
      default:
        break;
    }
  }

  /**
   * Handle arrival at destination
   */
  public onArrival(): void {
    console.log('[DrinkVendorBehavior] onArrival called, current state:', this.state);
    
    if (this.state === 'recalling') {
      // Transition to patrol
      this.state = 'patrolling' as AIActorState;
      this.patrolTimer = this.config.patrol.intervalMs;
      console.log('[DrinkVendorBehavior] Arrived at recall point, starting patrol');
    } else if (this.state === 'moving' && this.targetFanActor) {
      // Transition to serving
      this.state = 'serving' as AIActorState;
      this.serviceTimer = this.config.serviceTime;
      console.log('[DrinkVendorBehavior] Arrived at fan, starting service (duration:', this.config.serviceTime, 'ms)');
      
      // Emit event for UI feedback (optional)
      // this.vendorActor.emit('serviceStarted', { fanPosition: this.targetFanActor.getPosition() });
    }
  }

  /**
   * Handle service completion
   */
  public onServeComplete(): void {
    if (this.targetFanActor) {
      // Final happiness boost
      const currentHappiness = this.targetFanActor.getHappiness();
      this.targetFanActor.setHappiness(Math.min(100, currentHappiness + 15));
      
      console.log('[DrinkVendorBehavior] Service complete - happiness boost applied');
      
      // Emit event for UI feedback (celebration animation, sound)
      // this.vendorActor.emit('serviceComplete', { fanPosition: this.targetFanActor.getPosition() });
    }
    
    // Clear target and return to idle
    this.targetFanActor = null;
    this.targetPosition = null;
    this.state = 'idle' as AIActorState;
    this.scanTimer = 1000; // Wait 1 second before next scan
  }

  /**
   * Get current state
   */
  public getState(): AIActorState {
    return this.state;
  }

  // === Private Update Methods ===

  /**
   * Update idle state - scan for targets
   */
  private updateIdle(deltaTime: number): void {
    this.scanTimer -= deltaTime;
    
    if (this.scanTimer <= 0) {
      console.log('[DrinkVendorBehavior] === SCANNING FOR TARGETS ===');
      console.log('[DrinkVendorBehavior] PathfindingService available:', !!this.pathfindingService);
      console.log('[DrinkVendorBehavior] Current vendor position:', this.vendorActor.getPosition());
      
      // TEMPORARY: Hardcode test target - first fan in Section B, row 0, col 0
      // This should be grid position (15, 12) based on stadium config
      const TEST_MODE = true;
      let target = null;
      
      if (TEST_MODE) {
        console.log('[DrinkVendorBehavior] TEST MODE: Forcing target to Section B, row 1, col 2');
        const sectionActors = this.aiManager.getSectionActors();
        if (sectionActors.length > 1) {
          const sectionB = sectionActors[1]; // Section B is index 1
          const testFan = sectionB.getFanActorAt(1, 2); // Row 1, Col 2 in Section B
          if (testFan) {
            const gridPos = testFan.getGridPosition();
            const worldPos = this.gridManager.gridToWorld(gridPos.row, gridPos.col);
            target = {
              fanActor: testFan,
              fan: testFan.getFan(),
              sectionIdx: 1,
              rowIdx: gridPos.row,
              colIdx: gridPos.col,
              x: worldPos.x,
              y: worldPos.y
            };
            console.log('[DrinkVendorBehavior] Test target created:', {
              gridPos,
              worldPos,
              thirst: testFan.getThirst()
            });
          } else {
            console.error('[DrinkVendorBehavior] Test fan not found at Section B (1,2)');
          }
        }
      } else {
        // Normal mode - scan for thirsty fans
        target = this.selectTarget();
        console.log('[DrinkVendorBehavior] selectTarget() returned:', target ? 'valid target' : 'null');
      }
      
      if (target) {
        console.log('[DrinkVendorBehavior] Target acquired:', {
          section: target.sectionIdx,
          gridRow: target.rowIdx,
          gridCol: target.colIdx,
          worldX: target.x.toFixed(1),
          worldY: target.y.toFixed(1)
        });
        
        // Found a target - store direct reference to FanActor
        this.targetFanActor = target.fanActor;
        this.targetPosition = {
          row: target.rowIdx,
          col: target.colIdx,
          sectionIdx: target.sectionIdx
        };
        
        // Request pathfinding to target position
        if (this.pathfindingService) {
          const vendorPos = this.vendorActor.getPosition();
          console.log('[DrinkVendorBehavior] Requesting path from', 
            `(${vendorPos.x.toFixed(1)}, ${vendorPos.y.toFixed(1)})`,
            'to',
            `(${target.x.toFixed(1)}, ${target.y.toFixed(1)})`);
          
          const path = this.pathfindingService.requestPath(
            vendorPos.x,
            vendorPos.y,
            target.x,
            target.y
          );
          
          console.log('[DrinkVendorBehavior] Path result:', path ? `${path.length} cells` : 'null/empty');
          
          if (path && path.length > 0) {
            console.log('[DrinkVendorBehavior] Path preview (first 5 cells):', 
              path.slice(0, 5).map(c => `(${c.row},${c.col})`).join(' -> '));
            
            this.vendorActor.setPath(path);
            const vendorHasPath = this.vendorActor.hasPath();
            console.log('[DrinkVendorBehavior] Vendor hasPath() after setPath:', vendorHasPath);
            
            this.state = 'moving' as AIActorState;
            console.log(`[DrinkVendorBehavior] STATE TRANSITION: idle -> moving`);
          } else {
            console.warn(`[DrinkVendorBehavior] ❌ No path found to target at grid (${target.rowIdx}, ${target.colIdx})`);
            console.warn('[DrinkVendorBehavior] Checking grid passability:');
            const vendorGrid = this.gridManager.worldToGrid(vendorPos.x, vendorPos.y);
            const targetGrid = this.gridManager.worldToGrid(target.x, target.y);
            if (vendorGrid) {
              const vendorCell = this.gridManager.getCell(vendorGrid.row, vendorGrid.col);
              console.warn('  Vendor cell:', vendorCell);
            }
            if (targetGrid) {
              const targetCell = this.gridManager.getCell(targetGrid.row, targetGrid.col);
              console.warn('  Target cell:', targetCell);
            }
            this.scanTimer = 2000; // Retry in 2 seconds
          }
        } else {
          console.error('[DrinkVendorBehavior] ❌ No pathfinding service available');
          this.state = 'moving' as AIActorState; // Fallback to moving state anyway
        }
      } else {
        console.log('[DrinkVendorBehavior] No targets found - waiting 2s before next scan');
        this.scanTimer = 2000; // 2 seconds
      }
    }
  }

  /**
   * Update serving state - gradually reduce fan thirst
   */
  private updateServing(deltaTime: number): void {
    this.serviceTimer -= deltaTime;
    
    if (this.targetFanActor && this.serviceTimer > 0) {
      // Continuously reduce thirst during service
      // Total reduction: 100 thirst over serviceTime milliseconds
      const reductionRate = 100 / this.config.serviceTime;
      const reduction = reductionRate * deltaTime;
      
      const currentThirst = this.targetFanActor.getThirst();
      const newThirst = Math.max(0, currentThirst - reduction);
      this.targetFanActor.setThirst(newThirst);
      
      // Log occasionally for debugging
      if (Math.random() < 0.01) {
        console.log(`[DrinkVendorBehavior] Serving... thirst: ${currentThirst.toFixed(1)} → ${newThirst.toFixed(1)}`);
      }
    }
    
    // Service complete when timer expires
    if (this.serviceTimer <= 0) {
      this.onServeComplete();
    }
  }

  /**
   * Initiate recall to nearest vertical access point
   */
  private initiateRecall(): void {
    const currentPos = this.vendorActor.getGridPosition();
    const access = this.gridManager.getNearestVerticalAccess(currentPos.row, currentPos.col);
    
    if (!access) {
      console.warn('[DrinkVendorBehavior] No valid access point found for recall, staying idle');
      this.state = 'idle' as AIActorState;
      return;
    }
    
    this.state = 'recalling' as AIActorState;
    console.log(`[DrinkVendorBehavior] Recalling to ${access.zone} at (${access.row},${access.col})`);
    
    // TODO: Request path to access point via AIManager
  }

  /**
   * Update patrol behavior
   */
  private updatePatrol(deltaTime: number): void {
    this.patrolTimer -= deltaTime;
    
    if (this.patrolTimer <= 0) {
      // Pick random waypoint
      const currentPos = this.vendorActor.getGridPosition();
      const allowedZones = this.config.patrol.zones as ReadonlyArray<ZoneType>;
      const validCells = this.gridManager.getAllCells().filter(cell => {
        // Filter to patrol zones within ±5 columns
        return (
          allowedZones.includes(cell.zoneType) &&
          cell.passable &&
          Math.abs(cell.col - currentPos.col) <= 5
        );
      });
      
      if (validCells.length > 0) {
        const randomCell = validCells[Math.floor(Math.random() * validCells.length)];
        console.log(`[DrinkVendorBehavior] Patrol waypoint selected: (${randomCell.row},${randomCell.col})`);
        
        // TODO: Request path to waypoint
        this.state = 'moving' as AIActorState;
      }
      
      // Reset timer
      this.patrolTimer = this.config.patrol.intervalMs;
    }
  }

  /**
   * Check if cell is adjacent to stair zone
   */
  private isStairAdjacent(row: number, col: number): boolean {
    const neighbors = [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 },
    ];
    
    return neighbors.some(n => {
      const cell = this.gridManager.getCell(n.row, n.col);
      return cell?.zoneType === 'stair';
    });
  }

  /**
   * Find adjacent seat candidates for retry logic
   * Returns candidates in priority order: target → horizontal → vertical (if allowed)
   */
  private findAdjacentSeatCandidates(
    targetRow: number,
    targetCol: number,
    section: StadiumSection
  ): Array<{ row: number; col: number }> {
    const candidates: Array<{ row: number; col: number }> = [];
    
    // Add target first
    candidates.push({ row: targetRow, col: targetCol });
    
    // Add horizontal neighbors
    candidates.push({ row: targetRow, col: targetCol - 1 });
    candidates.push({ row: targetRow, col: targetCol + 1 });
    
    // Check if vertical adjacency allowed
    const totalColumns = section.getRows().reduce((max, row) => Math.max(max, row.seats.length), 0);
    const lastColumn = totalColumns > 0 ? totalColumns - 1 : 0;
    const isEdgeColumn = targetCol === 0 || targetCol === lastColumn;
    const isStairBoundary = this.isStairAdjacent(targetRow, targetCol);
    
    if (isEdgeColumn || isStairBoundary) {
      candidates.push({ row: targetRow - 1, col: targetCol });
      candidates.push({ row: targetRow + 1, col: targetCol });
    }
    
    return candidates;
  }
}
