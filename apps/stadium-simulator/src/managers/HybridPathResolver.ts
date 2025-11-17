import type { VendorProfile, PathSegment, PathNodeType } from '@/types/GameTypes';
import type { StadiumSection } from '@/sprites/StadiumSection';
import type { Fan } from '@/sprites/Fan';
import type { GridManager } from '@/managers/GridManager';
import { gameBalance } from '@/config/gameBalance';

/**
 * Navigation node types for hybrid pathfinding
 */

/** Corridor node (top or front of section) */
export interface CorridorNode {
  type: 'corridor';
  position: 'top' | 'front';
  sectionIdx: number;
  colIdx: number;
  x: number;
  y: number;
}

/** Stair node (left or right edge between sections) */
export interface StairNode {
  type: 'stair';
  side: 'left' | 'right';
  sectionIdx: number; // section it connects to
  y: number; // vertical position along stair
  x: number;
}

/** Row entry node (access point to a section row) */
export interface RowEntryNode {
  type: 'rowEntry';
  sectionIdx: number;
  rowIdx: number;
  colIdx: number;
  x: number;
  y: number;
}

/** Seat anchor node (specific fan location) */
export interface SeatNode {
  type: 'seat';
  sectionIdx: number;
  rowIdx: number;
  colIdx: number;
  x: number;
  y: number;
  fan?: Fan;
}

/** Union type for all navigation nodes */
export type NavigationNode = CorridorNode | StairNode | RowEntryNode | SeatNode;

/**
 * Navigation graph structure
 * Maps node IDs to their neighbors with edge costs
 */
export interface NavigationGraph {
  nodes: Map<string, NavigationNode>;
  edges: Map<string, Array<{ targetNodeId: string; baseCost: number }>>;
}

/**
 * Target scoring result for vendor targeting
 */
export interface TargetScore {
  fan: Fan;
  sectionIdx: number;
  rowIdx: number;
  colIdx: number;
  score: number; // higher is better
  estimatedCost: number;
  thirstLevel: number;
  happinessLevel: number;
}

/**
 * HybridPathResolver implements layered heuristic pathfinding for vendors
 * 
 * Architecture:
 * - Phase 1: Global zone selection (which section, which side/stair)
 * - Phase 2: Intra-section approach (top vs front corridor entry)
 * - Phase 3: Row infiltration and seat micro-positioning
 * 
 * Cost Function:
 * - cost = manhattanDistance + terrainPenalty * (1 - vendorEfficiency) - targetValueScore
 * - terrainPenalty accounts for row slowdown, seat occupancy, grump presence
 * - vendorEfficiency from quality tier modifier
 * - targetValueScore prioritizes high-thirst or low-happiness fans
 * 
 * Detour Logic:
 * - Tracks cumulative penalty along path
 * - Triggers local detour search when penalty exceeds vendor's tolerance
 * - Expands small neighborhood (adjacent row entry, alternative stair) for lower-cost branch
 * 
 * Future Expansion:
 * - Full A* implementation can be swapped in using same node schema
 * - Multi-vendor collision avoidance via dynamic cost adjustments
 * - Stair connector geometry and vertical movement modeling
 */
export class HybridPathResolver {
  private graph: NavigationGraph;
  private sections: StadiumSection[];
  private gridManager?: GridManager;

  constructor(sections: StadiumSection[], gridManager?: GridManager) {
    this.sections = sections;
    this.gridManager = gridManager;
    this.graph = this.buildNavigationGraph(sections);
  }

  /**
   * Build navigation graph from stadium sections
   * Creates a hierarchical navigation graph with:
   * - Corridor nodes (top/front of each section)
   * - Row entry nodes (access points to each row)
   * - Seat nodes (for occupied seats)
   * - Uses GridManager when available for accurate passability and cost
   * 
   * @param sections Array of StadiumSection objects
   * @returns Navigation graph structure
   */
  private buildNavigationGraph(sections: StadiumSection[]): NavigationGraph {
    const nodes = new Map<string, NavigationNode>();
    const edges = new Map<string, Array<{ targetNodeId: string; baseCost: number }>>();

    // Phase 1: Create corridor nodes for each section
    sections.forEach((section, sectionIdx) => {
      const sectionBounds = section.getBounds();
      const centerX = sectionBounds.x + sectionBounds.width / 2;
      
      // Top corridor (above section)
      const topCorridorId = `corridor_top_${sectionIdx}`;
      nodes.set(topCorridorId, {
        type: 'corridor',
        position: 'top',
        sectionIdx,
        colIdx: Math.floor(section.getRows()[0]?.getSeats().length / 2) || 4,
        x: centerX,
        y: sectionBounds.y - gameBalance.vendorMovement.corridorWidth,
      });

      // Front corridor (below section)
      const frontCorridorId = `corridor_front_${sectionIdx}`;
      nodes.set(frontCorridorId, {
        type: 'corridor',
        position: 'front',
        sectionIdx,
        colIdx: Math.floor(section.getRows()[0]?.getSeats().length / 2) || 4,
        x: centerX,
        y: sectionBounds.y + sectionBounds.height + gameBalance.vendorMovement.corridorWidth,
      });
    });

    // Phase 2: Create stair nodes between adjacent sections
    for (let i = 0; i < sections.length - 1; i++) {
      const currentSection = sections[i];
      const nextSection = sections[i + 1];
      const currentBounds = currentSection.getBounds();
      const nextBounds = nextSection.getBounds();
      
      // Right stair of current section (connects to left of next)
      const rightStairId = `stair_right_${i}`;
      nodes.set(rightStairId, {
        type: 'stair',
        side: 'right',
        sectionIdx: i,
        x: currentBounds.x + currentBounds.width,
        y: (currentBounds.y + currentBounds.y + currentBounds.height) / 2,
      });

      // Connect stair to adjacent corridor nodes
      const topCorridorCurrentId = `corridor_top_${i}`;
      const topCorridorNextId = `corridor_top_${i + 1}`;
      const frontCorridorCurrentId = `corridor_front_${i}`;
      const frontCorridorNextId = `corridor_front_${i + 1}`;

      // Bidirectional connections
      this.addEdge(edges, topCorridorCurrentId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
      this.addEdge(edges, rightStairId, topCorridorCurrentId, gameBalance.vendorMovement.stairTransitionCost);
      this.addEdge(edges, rightStairId, topCorridorNextId, gameBalance.vendorMovement.stairTransitionCost);
      this.addEdge(edges, topCorridorNextId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
      this.addEdge(edges, frontCorridorCurrentId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
      this.addEdge(edges, rightStairId, frontCorridorCurrentId, gameBalance.vendorMovement.stairTransitionCost);
      this.addEdge(edges, rightStairId, frontCorridorNextId, gameBalance.vendorMovement.stairTransitionCost);
      this.addEdge(edges, frontCorridorNextId, rightStairId, gameBalance.vendorMovement.stairTransitionCost);
    }

    // Phase 3: Create row entry nodes for each section row
    sections.forEach((section, sectionIdx) => {
      const rows = section.getRows();
      const sectionBounds = section.getBounds();

      rows.forEach((row, rowIdx) => {
        const seats = row.getSeats();
        // Get row position from first seat's grid coordinates
        const firstSeat = seats[0];
        if (!firstSeat || !this.gridManager) return;
        const gridPos = firstSeat.getGridPosition();
        const worldPos = this.gridManager.gridToWorld(gridPos.row, gridPos.col);
        const rowY = worldPos.y;

        // Create entry nodes at both ends of row
        const leftEntryId = `rowEntry_left_${sectionIdx}_${rowIdx}`;
        const rightEntryId = `rowEntry_right_${sectionIdx}_${rowIdx}`;

        nodes.set(leftEntryId, {
          type: 'rowEntry',
          sectionIdx,
          rowIdx,
          colIdx: 0,
          x: sectionBounds.x,
          y: rowY,
        });

        nodes.set(rightEntryId, {
          type: 'rowEntry',
          sectionIdx,
          rowIdx,
          colIdx: seats.length - 1,
          x: sectionBounds.x + sectionBounds.width,
          y: rowY,
        });

        // Connect row entries to top corridor
        const topCorridorId = `corridor_top_${sectionIdx}`;
        const entryToCorridor = gameBalance.vendorMovement.rowEntryToCorridor || 50;
        this.addEdge(edges, leftEntryId, topCorridorId, entryToCorridor);
        this.addEdge(edges, topCorridorId, leftEntryId, entryToCorridor);
        this.addEdge(edges, rightEntryId, topCorridorId, entryToCorridor);
        this.addEdge(edges, topCorridorId, rightEntryId, entryToCorridor);

        // Connect row entries to front corridor
        const frontCorridorId = `corridor_front_${sectionIdx}`;
        this.addEdge(edges, leftEntryId, frontCorridorId, entryToCorridor);
        this.addEdge(edges, frontCorridorId, leftEntryId, entryToCorridor);
        this.addEdge(edges, rightEntryId, frontCorridorId, entryToCorridor);
        this.addEdge(edges, frontCorridorId, rightEntryId, entryToCorridor);

        // Connect left and right entries (traversing the row)
        const rowTraverseCost = seats.length * gameBalance.vendorMovement.baseSpeedRow;
        this.addEdge(edges, leftEntryId, rightEntryId, rowTraverseCost);
        this.addEdge(edges, rightEntryId, leftEntryId, rowTraverseCost);
      });

      // Connect adjacent row entries vertically (within same section)
      for (let rowIdx = 0; rowIdx < rows.length - 1; rowIdx++) {
        const currentLeftId = `rowEntry_left_${sectionIdx}_${rowIdx}`;
        const currentRightId = `rowEntry_right_${sectionIdx}_${rowIdx}`;
        const nextLeftId = `rowEntry_left_${sectionIdx}_${rowIdx + 1}`;
        const nextRightId = `rowEntry_right_${sectionIdx}_${rowIdx + 1}`;
        
        const verticalCost = gameBalance.vendorMovement.rowVerticalTransition || 30;
        this.addEdge(edges, currentLeftId, nextLeftId, verticalCost);
        this.addEdge(edges, nextLeftId, currentLeftId, verticalCost);
        this.addEdge(edges, currentRightId, nextRightId, verticalCost);
        this.addEdge(edges, nextRightId, currentRightId, verticalCost);
      }
    });

    // Phase 4: Use GridManager to refine costs if available
    if (this.gridManager) {
      // For each edge, check if GridManager provides better cost data
      // This would involve checking passability and terrain penalties
      // For now, we'll keep the basic graph but this is where grid integration happens
      console.log('[HybridPathResolver] GridManager available - graph costs can be refined with terrain data');
    }

    return { nodes, edges };
  }

  /**
   * Helper to add bidirectional edge to graph
   */
  private addEdge(
    edges: Map<string, Array<{ targetNodeId: string; baseCost: number }>>,
    fromId: string,
    toId: string,
    cost: number
  ): void {
    if (!edges.has(fromId)) {
      edges.set(fromId, []);
    }
    edges.get(fromId)!.push({ targetNodeId: toId, baseCost: cost });
  }

  /**
   * Plan a path from vendor's current position to target node
   * Uses Dijkstra's algorithm to find lowest-cost path through navigation graph
   * 
   * Algorithm:
   * 1. Find nearest node to vendor's current position
   * 2. Find nearest node to target position
   * 3. Use Dijkstra to find shortest path between nodes
   * 4. Convert node path to PathSegment array
   * 
   * @param vendor Vendor profile with quality and abilities
   * @param fromX Current X position
   * @param fromY Current Y position
   * @param toNode Target navigation node
   * @returns Array of path segments to follow
   */
  public planPath(
    vendor: VendorProfile,
    fromX: number,
    fromY: number,
    toNode: NavigationNode
  ): PathSegment[] {
    // Find nearest node to current position
    const startNode = this.findNearestNode(fromX, fromY);
    if (!startNode) {
      // No nodes available - return direct path
      return [{
        nodeType: 'seat',
        sectionIdx: 0,
        rowIdx: 0,
        colIdx: 0,
        x: toNode.x,
        y: toNode.y,
        cost: this.calculateDistance(fromX, fromY, toNode.x, toNode.y),
      }];
    }

    // Find node ID for target
    const targetNodeId = this.getNodeId(toNode);
    const startNodeId = this.getNodeId(startNode);

    // Run Dijkstra's algorithm
    const nodePath = this.dijkstra(startNodeId, targetNodeId);
    
    // Convert node path to PathSegment array
    const segments: PathSegment[] = [];
    
    // Add initial segment from current position to first node
    if (nodePath.length > 0) {
      const firstNode = this.graph.nodes.get(nodePath[0]);
      if (firstNode) {
        segments.push(this.nodeToSegment(firstNode, this.calculateDistance(fromX, fromY, firstNode.x, firstNode.y)));
      }
    }

    // Add segments for each node in path
    for (let i = 0; i < nodePath.length - 1; i++) {
      const currentNode = this.graph.nodes.get(nodePath[i]);
      const nextNode = this.graph.nodes.get(nodePath[i + 1]);
      if (currentNode && nextNode) {
        const cost = this.calculateDistance(currentNode.x, currentNode.y, nextNode.x, nextNode.y);
        segments.push(this.nodeToSegment(nextNode, cost));
      }
    }

    return segments.length > 0 ? segments : [{
      nodeType: 'seat',
      sectionIdx: 0,
      rowIdx: 0,
      colIdx: 0,
      x: toNode.x,
      y: toNode.y,
      cost: this.calculateDistance(fromX, fromY, toNode.x, toNode.y),
    }];
  }

  /**
   * Dijkstra's algorithm for shortest path
   * @param startNodeId Starting node ID
   * @param targetNodeId Target node ID
   * @returns Array of node IDs representing the path
   */
  private dijkstra(startNodeId: string, targetNodeId: string): string[] {
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>();

    // Initialize all nodes
    for (const nodeId of this.graph.nodes.keys()) {
      distances.set(nodeId, nodeId === startNodeId ? 0 : Infinity);
      previous.set(nodeId, null);
      unvisited.add(nodeId);
    }

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let currentNodeId: string | null = null;
      let minDistance = Infinity;
      for (const nodeId of unvisited) {
        const dist = distances.get(nodeId) ?? Infinity;
        if (dist < minDistance) {
          minDistance = dist;
          currentNodeId = nodeId;
        }
      }

      // No path exists
      if (currentNodeId === null || minDistance === Infinity) break;

      // Reached target
      if (currentNodeId === targetNodeId) break;

      unvisited.delete(currentNodeId);

      // Check all neighbors
      const edges = this.graph.edges.get(currentNodeId) ?? [];
      for (const edge of edges) {
        if (!unvisited.has(edge.targetNodeId)) continue;

        const altDistance = (distances.get(currentNodeId) ?? Infinity) + edge.baseCost;
        if (altDistance < (distances.get(edge.targetNodeId) ?? Infinity)) {
          distances.set(edge.targetNodeId, altDistance);
          previous.set(edge.targetNodeId, currentNodeId);
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = targetNodeId;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) ?? null;
      if (current === startNodeId) {
        path.unshift(startNodeId);
        break;
      }
    }

    return path;
  }

  /**
   * Find nearest navigation node to a world position
   */
  private findNearestNode(x: number, y: number): NavigationNode | null {
    let nearest: NavigationNode | null = null;
    let minDistance = Infinity;

    for (const node of this.graph.nodes.values()) {
      const dist = this.calculateDistance(x, y, node.x, node.y);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = node;
      }
    }

    return nearest;
  }

  /**
   * Generate unique node ID from node data
   */
  private getNodeId(node: NavigationNode): string {
    switch (node.type) {
      case 'corridor':
        return `corridor_${node.position}_${node.sectionIdx}`;
      case 'stair':
        return `stair_${node.side}_${node.sectionIdx}`;
      case 'rowEntry':
        return `rowEntry_${node.colIdx === 0 ? 'left' : 'right'}_${node.sectionIdx}_${node.rowIdx}`;
      case 'seat':
        return `seat_${node.sectionIdx}_${node.rowIdx}_${node.colIdx}`;
    }
  }

  /**
   * Convert navigation node to path segment
   */
  private nodeToSegment(node: NavigationNode, cost: number): PathSegment {
    const nodeType: PathNodeType = node.type === 'rowEntry' ? 'rowEntry' : 
                                    node.type === 'stair' ? 'stair' :
                                    node.type === 'corridor' ? 'corridor' : 'seat';
    
    const colIdx = 'colIdx' in node ? node.colIdx : 0;
    const rowIdx = node.type === 'rowEntry' || node.type === 'seat' ? node.rowIdx : 0;
    
    return {
      nodeType,
      sectionIdx: node.sectionIdx,
      rowIdx,
      colIdx,
      x: node.x,
      y: node.y,
      cost,
    };
  }

  /**
   * Calculate segment cost based on terrain and vendor profile
   * 
   * Cost breakdown:
   * - Base movement cost (distance * base speed for node type)
   * - Row base penalty (if in row)
   * - Occupied seat penalties (per seat crossed)
   * - Grump penalties (multiplied for difficult terrain fans)
   * - Vendor ability overrides (ignore certain penalties)
   * - Quality efficiency modifier (scales total cost)
   * 
   * @param segment Path segment to evaluate
   * @param vendor Vendor profile
   * @param seatOccupancy Optional seat occupancy data for row
   * @param grumpPresence Optional grump/difficult terrain flags
   * @returns Total movement cost for this segment
   */
  public calculateSegmentCost(
    segment: PathSegment,
    vendor: VendorProfile,
    seatOccupancy?: boolean[],
    grumpPresence?: boolean[]
  ): number {
    let cost = segment.cost; // base distance cost

    // Apply node type base speed modifier
    const speedModifiers = {
      corridor: gameBalance.vendorMovement.baseSpeedCorridor,
      stair: gameBalance.vendorMovement.baseSpeedStair,
      rowEntry: gameBalance.vendorMovement.baseSpeedRow,
      seat: gameBalance.vendorMovement.baseSpeedRow,
    };

    cost = cost / speedModifiers[segment.nodeType];

    // Apply row base penalty if in row (unless vendor ignores it)
    if ((segment.nodeType === 'rowEntry' || segment.nodeType === 'seat') 
        && !vendor.abilities.ignoreRowPenalty) {
      cost *= (1 + gameBalance.vendorMovement.rowBasePenalty);
    }

    // Apply seat occupancy and grump penalties if provided
    if (seatOccupancy && segment.colIdx !== undefined) {
      const col = segment.colIdx;
      if (seatOccupancy[col]) {
        cost *= (1 + gameBalance.vendorMovement.occupiedSeatPenalty);
      }

      // Apply grump penalty if present and vendor doesn't ignore it
      if (grumpPresence && grumpPresence[col] && !vendor.abilities.ignoreGrumpPenalty) {
        const grumpPenalty = gameBalance.vendorMovement.rowBasePenalty 
          * gameBalance.vendorMovement.grumpPenaltyMultiplier;
        const cappedPenalty = Math.min(grumpPenalty, gameBalance.vendorMovement.maxTerrainPenalty);
        cost *= (1 + cappedPenalty);
      }
    }

    // Apply vendor quality efficiency modifier
    const qualityConfig = gameBalance.vendorQuality[vendor.qualityTier];
    cost = cost / qualityConfig.efficiencyModifier;

    return cost;
  }

  /**
   * Detect if cumulative path penalty exceeds tolerance threshold
   * Triggers local detour search to find alternative route
   * 
   * @param cumulativePenalty Current accumulated movement penalty
   * @param vendor Vendor profile with quality-based tolerance
   * @returns true if detour should be triggered
   */
  public detectDetourNeed(cumulativePenalty: number, vendor: VendorProfile): boolean {
    const qualityConfig = gameBalance.vendorQuality[vendor.qualityTier];
    const tolerance = qualityConfig.penaltyTolerance;
    return cumulativePenalty > tolerance;
  }

  /**
   * Find local detour around high-penalty segment
   * Currently a stub - returns null for Phase 1
   * 
   * Future implementation will:
   * 1. Expand small neighborhood around current position
   * 2. Consider alternative row entries or stair access
   * 3. Score alternative branches by cost reduction
   * 4. Return new segment array if better path found
   * 
   * @param fromNode Current position node
   * @param targetNode Destination node
   * @param avoidNodes Nodes to avoid (high penalty)
   * @returns Alternative path segments or null if no better route
   */
  public findLocalDetour(
    fromNode: NavigationNode,
    targetNode: NavigationNode,
    avoidNodes: Set<string>
  ): PathSegment[] | null {
    // TODO: Implement local detour search
    // For now, return null (no detour available)
    return null;
  }

  /**
   * Score potential target fans for drink vendor service
   * Considers thirst severity, distance, and path cost
   * 
   * @param vendor Vendor profile
   * @param fromX Current vendor X position
   * @param fromY Current vendor Y position
   * @param candidates Array of candidate fans with positions
   * @returns Sorted array of target scores (highest first)
   */
  public scoreTargets(
    vendor: VendorProfile,
    fromX: number,
    fromY: number,
    candidates: Array<{ fan: Fan; sectionIdx: number; rowIdx: number; colIdx: number; x: number; y: number }>
  ): TargetScore[] {
    const scores: TargetScore[] = [];

    for (const candidate of candidates) {
      const distance = this.calculateDistance(fromX, fromY, candidate.x, candidate.y);
      const thirst = candidate.fan.getThirst();
      const happiness = candidate.fan.getHappiness();

      // Score formula: thirstSeverity / (estimatedCost * efficiency)
      // Higher thirst = higher priority, lower cost = higher priority
      const thirstWeight = thirst / 100; // normalize to 0-1
      const estimatedCost = distance; // simplified for stub
      const qualityConfig = gameBalance.vendorQuality[vendor.qualityTier];
      const efficiency = qualityConfig.efficiencyModifier;

      const score = (thirstWeight * 100) / (estimatedCost * (1 / efficiency));

      scores.push({
        fan: candidate.fan,
        sectionIdx: candidate.sectionIdx,
        rowIdx: candidate.rowIdx,
        colIdx: candidate.colIdx,
        score,
        estimatedCost,
        thirstLevel: thirst,
        happinessLevel: happiness,
      });
    }

    // Sort descending by score
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate Manhattan distance between two points
   */
  private calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x2 - x1) + Math.abs(y2 - y1);
  }

  /**
   * Get navigation graph (for debugging/visualization)
   */
  public getGraph(): NavigationGraph {
    return this.graph;
  }

  /**
   * Rebuild graph when sections change
   */
  public rebuildGraph(sections: StadiumSection[]): void {
    this.sections = sections;
    this.graph = this.buildNavigationGraph(sections);
    console.log(`[HybridPathResolver] Navigation graph rebuilt: ${this.graph.nodes.size} nodes, ${this.graph.edges.size} edge sets`);
  }
}
