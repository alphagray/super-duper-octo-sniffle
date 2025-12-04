/**
 * AI Behavior abstraction for vendor actors
 * Defines state machine and behavior interface for polymorphic vendor AI
 */

/**
 * AI actor state machine states
 */
export enum AIActorState {
  /** Vendor is inactive, waiting for player assignment */
  Idle = 'idle',
  /** Vendor is awaiting player targeting (initial state) */
  AwaitingAssignment = 'awaitingAssignment',
  /** Vendor is selecting a target seat/fan */
  Assigning = 'assigning',
  /** Vendor is moving along a path */
  Moving = 'moving',
  /** Vendor is serving a fan */
  Serving = 'serving',
  /** Vendor has determined recall is needed, preparing to move */
  RecallPending = 'recallPending',
  /** Vendor is returning to neutral zone */
  Recalling = 'recalling',
  /** Vendor is patrolling in neutral zone */
  Patrolling = 'patrolling',
  /** Vendor is dropping off at drop zone (fade out, delay, fade in) */
  DroppingOff = 'droppingOff',
  /** Vendor was hit by wave and is splatting (tumbling, falling, prone) */
  Splatted = 'splatted',
}

/**
 * AI behavior interface
 * Encapsulates all targeting, decision-making, and service logic for vendor actors
 */
export interface AIActorBehavior {
  /**
   * Request assignment to a target cell (typically a seat)
   * Triggers targeting logic, seat selection, and path planning
   * 
   * @param targetCell Grid coordinates of target cell
   */
  requestAssignment(targetCell: { row: number; col: number }): void;

  /**
   * Request recall to neutral zone
   * Vendor will path to nearest corridor or ground zone and enter patrol
   */
  requestRecall(): void;

  /**
   * Update behavior state based on elapsed time
   * Called every frame by the actor's update method
   * 
   * @param deltaTime Time elapsed since last tick (milliseconds)
   * @param roundTime Time relative to round start (negative = time remaining in timed mode, positive = elapsed in eternal mode)
   */
  tick(deltaTime: number, roundTime: number): void;

  /**
   * Handle arrival at current path destination
   * Triggers state transitions (e.g., moving → serving, recalling → patrolling)
   */
  onArrival(): void;

  /**
   * Handle completion of service action
   * Re-evaluates targets or initiates recall if no valid targets remain
   */
  onServeComplete(): void;

  /**
   * Get current behavior state
   * 
   * @returns Current AIActorState
   */
  getState(): AIActorState;
}
