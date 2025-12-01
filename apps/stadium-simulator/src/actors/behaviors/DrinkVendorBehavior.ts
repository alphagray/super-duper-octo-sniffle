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
  // Removed TEST_MODE hardcoded targeting (was used for debugging pathfinding)
  private vendorActor: DrinkVendorActor;
  private aiManager: AIManager;
  private gridManager: GridManager;
  private actorRegistry: ActorRegistry;
  private pathfindingService: PathfindingService | null = null;
  
  // Configuration (merged defaults + overrides)
  private config: typeof gameBalance.vendorTypes.drink;
  
  // State machine
  private state: AIActorState = 'awaitingAssignment' as AIActorState;
  
  // Target tracking (direct actor reference)
  private targetFanActor: any | null = null; // FanActor
  private targetPosition: { row: number; col: number; sectionIdx: number } | null = null;
  
  // Assignment tracking (player-driven)
  private assignedSectionIdx: number | null = null;
  private retryCount: number = 0;
  
  // Timing
  private serviceTimer: number = 0;
  private scanTimer: number = 0;
  private idleTimer: number = 0; // Track time without target (triggers patrol)
  private cooldownTimer: number = 0; // Post-assignment cooldown
  
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
    
    if (!this.pathfindingService) {
      console.error('[DrinkVendorBehavior] CRITICAL: PathfindingService is null/undefined! Vendor will not be able to pathfind.');
    } else {
      console.log('[DrinkVendorBehavior] PathfindingService initialized successfully');
    }
  }

  /**
   * Request assignment (legacy interface method, use assignToSection instead)
   * @deprecated Use assignToSection for player-driven flow
   */
  public requestAssignment(targetCell: { row: number; col: number }): void {
    console.log(`[DrinkVendorBehavior] requestAssignment called (deprecated), ignoring`);
  }
  
  /**
   * Assign vendor to specific section (player-driven)
   * Vendor will scan only this section for targets
   */
  public assignToSection(sectionIdx: number, targetRow?: number, targetCol?: number): void {
    console.log(`[DrinkVendorBehavior] assignToSection called: section=${sectionIdx}, targetRow=${targetRow}, targetCol=${targetCol}, hasPathfinding=${!!this.pathfindingService}`);

    // Defensive check: Cannot assign without pathfinding service
    if (!this.pathfindingService) {
      console.error('[DrinkVendorBehavior] Cannot assign to section - PathfindingService is not available!');
      this.state = 'awaitingAssignment' as AIActorState;
      return;
    }

    this.assignedSectionIdx = sectionIdx;
    this.state = 'idle' as AIActorState;
    this.scanTimer = 0; // Scan immediately
    this.idleTimer = 0; // Reset idle timeout
    this.cooldownTimer = gameBalance.vendorAssignment.cooldownMs;

    // Set targetFanActor if possible
    this.targetFanActor = null;
    if (
      sectionIdx !== undefined &&
      targetRow !== undefined &&
      targetCol !== undefined
    ) {
      const sectionActors = this.aiManager.getSectionActors();
      const sectionActor = sectionActors[sectionIdx];
      if (!sectionActor) {
        console.error(`[DrinkVendorBehavior] No section actor found at index ${sectionIdx}`);
      } else {
        // Try global lookup first (preferred) then fallback to local indices if provided seat data used local row/col
        if (typeof sectionActor.getFanActorAtGlobal === 'function') {
          this.targetFanActor = sectionActor.getFanActorAtGlobal(targetRow, targetCol) || null;
        } else if (typeof sectionActor.getFanActorAt === 'function') {
          this.targetFanActor = sectionActor.getFanActorAt(targetRow, targetCol) || null;
        }
        if (this.targetFanActor) {
          console.log(`[DrinkVendorBehavior] Target fan actor set for section=${sectionIdx}, row=${targetRow}, col=${targetCol}`);
        } else {
          console.warn(`[DrinkVendorBehavior] No fan actor found at section=${sectionIdx}, row=${targetRow}, col=${targetCol}`);
        }
      }
    }

    // Use provided targetRow/targetCol directly (no debug override)
    const desiredRow = targetRow;
    const desiredCol = targetCol;

    // If we have a resolved target and pathfinding service, request a path
    if (desiredRow !== undefined && desiredCol !== undefined && this.pathfindingService) {
      const targetWorld = this.gridManager.gridToWorld(desiredRow, desiredCol);
      const vendorPos = this.vendorActor.getPosition();
      console.log(`[DrinkVendorBehavior] Requesting path from (${vendorPos.x},${vendorPos.y}) to (${targetWorld.x},${targetWorld.y})`);

      const path = this.pathfindingService.requestPath(
        vendorPos.x,
        vendorPos.y,
        targetWorld.x,
        targetWorld.y
      );

      console.log(`[DrinkVendorBehavior] Path result: ${path ? `${path.length} cells` : 'null'}`);

      if (path && path.length > 0) {
        this.vendorActor.setPath(path);
        this.targetPosition = { row: desiredRow, col: desiredCol, sectionIdx } as { row: number; col: number; sectionIdx: number };
        // Use unified 'moving' state so onArrival() logic triggers correctly
        this.state = 'moving' as AIActorState;
        console.log(`[DrinkVendorBehavior] Pathing to target (${desiredRow},${desiredCol}), path has ${path.length} cells (state=moving)`);
      } else {
        // Pathfinding failed - detailed failure diagnostics
        const startGrid = this.gridManager.worldToGrid(vendorPos.x, vendorPos.y);
        const endGrid = this.gridManager.worldToGrid(targetWorld.x, targetWorld.y);
        console.error(`[DrinkVendorBehavior] Pathfinding failed to (${desiredRow},${desiredCol}). startGrid=${startGrid ? `${startGrid.row},${startGrid.col}` : 'null'} endGrid=${endGrid ? `${endGrid.row},${endGrid.col}` : 'null'}`);
        if (startGrid) {
          const c = this.gridManager.getCell(startGrid.row, startGrid.col);
          console.warn('[StartCell]', { passable: c?.passable, zone: c?.zoneType, walls: c?.walls, out: c?.allowedOutgoing, inc: c?.allowedIncoming });
        }
        if (endGrid) {
          const c = this.gridManager.getCell(endGrid.row, endGrid.col);
          console.warn('[EndCell]', { passable: c?.passable, zone: c?.zoneType, walls: c?.walls, out: c?.allowedOutgoing, inc: c?.allowedIncoming });
        }

        // TODO: Emit event for UI feedback when AIManager has public event method
        // this.aiManager.emit('vendorAssignmentFailed', {
        //   vendorId: (this.vendorActor as any).id,
        //   reason: 'No path found',
        //   targetRow: desiredRow,
        //   targetCol: desiredCol,
        //   sectionIdx
        // });

        // Reset to awaiting assignment so user can retry
        this.state = 'awaitingAssignment' as AIActorState;
        this.assignedSectionIdx = null;
      }
    } else {
      console.log(`[DrinkVendorBehavior] No target coordinates or pathfinding service unavailable, will scan for targets`);
    }

    console.log(`[DrinkVendorBehavior] Assigned to section ${sectionIdx}, final state: ${this.state}`);
  }
  
  /**
   * Cancel current assignment (return to awaiting)
   */
  public cancelAssignment(): void {
    this.assignedSectionIdx = null;
    this.targetFanActor = null;
    this.targetPosition = null;
    this.state = 'awaitingAssignment' as AIActorState;
    this.idleTimer = 0;
    
    console.log('[DrinkVendorBehavior] Assignment cancelled');
  }
  
  /**
   * Get assigned section index (null if not assigned)
   */
  public getAssignedSection(): number | null {
    return this.assignedSectionIdx;
  }
  
  /**
   * Get cooldown timer remaining (milliseconds)
   */
  public getCooldownTimer(): number {
    return this.cooldownTimer;
  }
  
  /**
   * Start patrol mode (fallback when no targets found)
   */
  public startPatrol(): void {
    const currentPos = this.vendorActor.getGridPosition();
    const access = this.gridManager.getNearestVerticalAccess(currentPos.row, currentPos.col);
    
    if (!access) {
      console.warn('[DrinkVendorBehavior] No valid access point for patrol, staying at position');
      this.state = 'awaitingAssignment' as AIActorState;
      return;
    }
    
    this.state = 'patrolling' as AIActorState;
    this.patrolTimer = gameBalance.vendorAssignment.patrolIntervalMs;
    this.assignedSectionIdx = null; // Clear section assignment
    
    console.log(`[DrinkVendorBehavior] Starting patrol mode, moving to (${access.row},${access.col})`);
    
    // Request path to access point
    if (this.pathfindingService) {
      const targetWorld = this.gridManager.gridToWorld(access.row, access.col);
      const vendorPos = this.vendorActor.getPosition();
      const path = this.pathfindingService.requestPath(
        vendorPos.x,
        vendorPos.y,
        targetWorld.x,
        targetWorld.y
      );
      
      if (path && path.length > 0) {
        this.vendorActor.setPath(path);
      }
    }
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
    // Update cooldown timer
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= deltaTime;
      if (this.cooldownTimer <= 0) {
        this.cooldownTimer = 0;
        // TODO: Emit event via AIManager for UI to re-enable button
        console.log('[DrinkVendorBehavior] Cooldown complete');
      }
    }
    
    switch (this.state) {
      case 'awaitingAssignment':
        // Idle until player assigns to section
        break;
        
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
   * Force immediate recall/patrol: abort service or movement and start patrol cycle.
   * Used by UI recall button to hard overwrite current assignment.
   */
  public forceRecallPatrol(): void {
    console.log('[DrinkVendorBehavior] forceRecallPatrol invoked - aborting current activity');
    // Clear any active service/target
    this.targetFanActor = null;
    this.targetPosition = null;
    this.serviceTimer = 0;
    // Clear path so movement halts immediately
    this.vendorActor.clearPath();
    // Remove assignment so vendor returns to global scanning later
    this.assignedSectionIdx = null;
    // Enter patrol mode directly
    this.startPatrol();
  }
  
  /**
   * Ensure arrival at patrol waypoint resets state back to patrolling (no targetFanActor)
   */
  public finalizePatrolArrival(): void {
    if (this.state === 'moving' && !this.targetFanActor) {
      this.state = 'patrolling' as AIActorState;
      console.log('[DrinkVendorBehavior] Patrol waypoint reached -> patrolling');
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
    } else if (this.state === 'moving') {
      // Reached movement destination without a fan target (e.g., patrol waypoint)
      console.log('[DrinkVendorBehavior] Arrived at patrol waypoint');
      // Resume patrolling idle between waypoints
      this.state = 'patrolling' as AIActorState;
      this.patrolTimer = this.config.patrol.intervalMs;
      // Clear any residual path to avoid lingering movement state
      this.vendorActor.clearPath();
    }

    // Emit arrival event through AI manager for scene listeners (vendorReachedTarget)
    // StadiumScene listens for this to trigger arrival visuals
    try {
      this.aiManager.notifyVendorArrival((this.vendorActor as any).id, this.vendorActor.getPosition());
    } catch (e) {
      // Fail silently if AIManager method signature changes
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
    }
    
    // Notify AIManager for event emission (speech bubbles, UI updates)
    try {
      // Extract numeric vendor ID from actor ID (expected format: "actor:vendor-{number}")
      const actorId = (this.vendorActor as any).id as string;
      const prefix = 'actor:vendor-';
      if (actorId.startsWith(prefix)) {
        const vendorId = parseInt(actorId.substring(prefix.length), 10);
        if (!isNaN(vendorId)) {
          this.aiManager.notifyVendorServiceComplete(vendorId);
        } else {
          console.warn('[DrinkVendorBehavior] Invalid vendor ID format:', actorId);
        }
      } else {
        console.warn('[DrinkVendorBehavior] Unexpected actor ID format:', actorId);
      }
    } catch (e) {
      console.warn('[DrinkVendorBehavior] Failed to notify service complete:', e);
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
    this.idleTimer += deltaTime;
    
    // Check idle timeout (no target found for 5s → patrol)
    if (this.idleTimer >= gameBalance.vendorAssignment.idleTimeoutMs) {
      console.log('[DrinkVendorBehavior] Idle timeout reached, entering patrol mode');
      // TODO: Emit event via AIManager for UI update
      this.startPatrol();
      return;
    }
    
    if (this.scanTimer <= 0) {
      console.log('[DrinkVendorBehavior] === SCANNING FOR TARGETS ===');
      console.log('[DrinkVendorBehavior] PathfindingService available:', !!this.pathfindingService);
      console.log('[DrinkVendorBehavior] Current vendor position:', this.vendorActor.getPosition());
      
      // Scan for thirsty fans
      const target = this.selectTarget();
      console.log('[DrinkVendorBehavior] selectTarget() returned:', target ? 'valid target' : 'null');
      
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
            this.idleTimer = 0; // Reset idle timer when moving to target
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
    
    // If currently moving along a patrol path, let VendorActor handle progression
    if (this.state === 'moving' && !this.targetFanActor) {
      return;
    }

    if (this.patrolTimer <= 0) {
      const currentPos = this.vendorActor.getGridPosition();
      const allowedZones = this.config.patrol.zones as ReadonlyArray<ZoneType>;
      const allCells = this.gridManager.getAllCells();

      const validCells = allCells.filter(cell => (
        allowedZones.includes(cell.zoneType) &&
        cell.passable &&
        // Stay within a modest horizontal band to avoid extreme wandering
        Math.abs(cell.col - currentPos.col) <= 6 &&
        // Avoid selecting current cell
        (cell.row !== currentPos.row || cell.col !== currentPos.col)
      ));

      if (validCells.length === 0) {
        // No patrol candidates; wait and retry
        this.patrolTimer = 1000;
        console.warn('[DrinkVendorBehavior] No valid patrol cells found; retrying in 1s');
        return;
      }

      const randomCell = validCells[Math.floor(Math.random() * validCells.length)];
      console.log(`[DrinkVendorBehavior] Patrol waypoint selected: (${randomCell.row},${randomCell.col}) zone=${randomCell.zoneType}`);

      if (this.pathfindingService) {
        const targetWorld = this.gridManager.gridToWorld(randomCell.row, randomCell.col);
        const vendorPos = this.vendorActor.getPosition();
        const path = this.pathfindingService.requestPath(
          vendorPos.x,
          vendorPos.y,
          targetWorld.x,
          targetWorld.y
        );
        if (path && path.length > 0) {
          this.vendorActor.setPath(path);
          this.state = 'moving' as AIActorState;
          console.log(`[DrinkVendorBehavior] Patrol path assigned (${path.length} cells)`);
        } else {
          console.warn('[DrinkVendorBehavior] Failed to generate patrol path; will retry');
        }
      } else {
        console.warn('[DrinkVendorBehavior] No pathfindingService for patrol movement');
      }

      // Reset patrol timer for next waypoint selection (even if path failed)
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
