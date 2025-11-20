import Phaser from 'phaser';
import { ActorLogger } from './ActorLogger';

// ============================================================================
// Legacy Phaser-based classes (for backward compatibility with existing sprites)
// ============================================================================

/**
 * BaseActorContainer provides logging for Phaser Container-based sprites.
 * Used by Fan and Vendor until they're migrated to new Actor system.
 */
export abstract class BaseActorContainer extends Phaser.GameObjects.Container {
  protected logger: ActorLogger;
  private static containerCounter = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, actorType: string, enableLogging = false) {
    super(scene, x, y);
    this.logger = new ActorLogger(actorType, BaseActorContainer.containerCounter++, enableLogging);
  }

  /** Enable/disable logging for this actor instance */
  public setLogging(enabled: boolean): void {
    this.logger.setEnabled(enabled);
  }
}

/**
 * BaseActorSprite provides logging for Phaser Sprite-based actors.
 * Used by Mascot until migrated to new Actor system.
 */
export abstract class BaseActorSprite extends Phaser.GameObjects.Sprite {
  protected logger: ActorLogger;
  private static spriteCounter = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, actorType: string, enableLogging = false) {
    super(scene, x, y, texture);
    this.logger = new ActorLogger(actorType, BaseActorSprite.spriteCounter++, enableLogging);
  }

  /** Enable/disable logging for this actor instance */
  public setLogging(enabled: boolean): void {
    this.logger.setEnabled(enabled);
  }
}

// ============================================================================
// New Actor hierarchy (decoupled from Phaser GameObject)
// ============================================================================

/**
 * Actor is the root abstraction for all game entities.
 * Provides common lifecycle hooks (update, draw) and logging infrastructure.
 * Decoupled from Phaser GameObject to allow flexible composition.
 * 
 * Taxonomy:
 * - AnimatedActor: Dynamic entities with stats/state that affect game logic (fans, vendors, mascots)
 * - SceneryActor: Static, non-interactive visual elements (sections, rows, seats)
 * - UtilityActor: Non-visual entities whose position/state matter for logic (waypoints, waves, zones)
 */
export abstract class Actor {
  protected logger: ActorLogger;
  protected scene: Phaser.Scene;
  public readonly id: string;
  public readonly actorType: string;

  constructor(scene: Phaser.Scene, id: string, actorType: string, enableLogging = false) {
    this.scene = scene;
    this.id = id;
    this.actorType = actorType;
    this.logger = new ActorLogger(actorType, id, enableLogging);
  }

  /** Enable/disable logging for this actor instance */
  public setLogging(enabled: boolean): void {
    this.logger.setEnabled(enabled);
  }

  /** 
   * Update logic called by scene or manager each frame.
   * @param delta Time elapsed since last frame (ms)
   */
  public abstract update(delta: number): void;

  /**
   * Draw/render logic (if visual). Non-visual actors can no-op.
   * Called after update when visual state needs refreshing.
   */
  public abstract draw(): void;

  /** Cleanup resources when actor is destroyed */
  public destroy(): void {
    this.logger.debug('Actor destroyed');
  }
}

/**
 * AnimatedActor: Dynamic entities with properties, animations, and state that affect gameplay.
 * Examples: Fan (stats: happiness/thirst/attention), Vendor (movement/service), Mascot (abilities).
 * These update every frame and respond to game events.
 */
export abstract class AnimatedActor extends Actor {
  protected displayObject: Phaser.GameObjects.GameObject;

  constructor(scene: Phaser.Scene, id: string, actorType: string, enableLogging = false) {
    super(scene, id, actorType, enableLogging);
    this.displayObject = this.createVisual();
  }

  /** Subclasses implement to create their Phaser visual representation */
  protected abstract createVisual(): Phaser.GameObjects.GameObject;

  /** AnimatedActors must implement frame-by-frame update logic */
  public abstract update(delta: number): void;

  /** AnimatedActors refresh their visual state based on internal properties */
  public abstract draw(): void;

  public getDisplayObject(): Phaser.GameObjects.GameObject {
    return this.displayObject;
  }

  public override destroy(): void {
    super.destroy();
    if (this.displayObject && !this.displayObject.scene) {
      // Already destroyed by Phaser scene cleanup
      return;
    }
    this.displayObject?.destroy();
  }
}

/**
 * SceneryActor: Static visual elements that don't animate or interact.
 * Examples: StadiumSection background, SectionRow structure, decorative elements.
 * These are "set and forget" — drawn once, no frame-by-frame updates.
 */
export abstract class SceneryActor extends Actor {
  protected displayObject: Phaser.GameObjects.GameObject;

  constructor(scene: Phaser.Scene, id: string, actorType: string, enableLogging = false) {
    super(scene, id, actorType, enableLogging);
    this.displayObject = this.createVisual();
  }

  /** Subclasses implement to create their Phaser visual representation */
  protected abstract createVisual(): Phaser.GameObjects.GameObject;

  /** Scenery actors don't update per frame by default */
  public update(delta: number): void {
    // No-op for static scenery; override if needed
  }

  /** Draw is a one-time setup; no per-frame refresh needed */
  public draw(): void {
    // Visual already created in constructor; no-op
  }

  public getDisplayObject(): Phaser.GameObjects.GameObject {
    return this.displayObject;
  }

  public override destroy(): void {
    super.destroy();
    if (this.displayObject && !this.displayObject.scene) {
      return;
    }
    this.displayObject?.destroy();
  }
}

/**
 * UtilityActor: Non-visual entities whose position/state matter for game logic.
 * Examples: Pathfinding waypoints, collision zones, AI decision points, active wave state.
 * These participate in game logic without being rendered.
 */
export abstract class UtilityActor extends Actor {
  protected x: number;
  protected y: number;

  constructor(scene: Phaser.Scene, id: string, actorType: string, x: number, y: number, enableLogging = false) {
    super(scene, id, actorType, enableLogging);
    this.x = x;
    this.y = y;
  }

  /** UtilityActors may have logic updates (AI, triggers) but no visuals */
  public abstract update(delta: number): void;

  /** No visual to draw; always no-op */
  public draw(): void {
    // Non-visual actors don't draw
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  public setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}
