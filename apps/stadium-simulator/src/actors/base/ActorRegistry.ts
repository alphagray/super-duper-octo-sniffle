import { Actor } from './Actor';

import type { ActorSnapshot, ActorQuery, ActorCategory } from '../interfaces/ActorTypes';
import { LoggerService } from '@/services/LoggerService';

/**
 * ActorRegistry: Central management of all game actors.
 * Handles registration, queries, updates, and state snapshots for UI consumption.
 */
export class ActorRegistry {
  private actors: Map<string, Actor> = new Map();
  private byCategory: Map<ActorCategory, Set<string>> = new Map();
  private logger = LoggerService.instance();

  /**
   * Type-safe lookup for a registered actor by id and type.
   * Returns the actor as type T if found, or undefined.
   */
  public getActorByType<T extends Actor = Actor>(id: string, type: string): T | undefined {
    const actor = this.actors.get(id);
    if (actor && actor.type === type) {
      return actor as T;
    }
    return undefined;
  }

  /**
   * Register an actor in the registry.
   */
  public register(actor: Actor): void {
    if (this.actors.has(actor.id)) {
      this.logger.push({ level: 'warn', category: 'system:registry', message: `Actor ${actor.id} already registered, replacing`, ts: Date.now() });
    }
    this.actors.set(actor.id, actor);

    // Add to category index
    const category = actor.category as ActorCategory;
    if (!this.byCategory.has(category)) {
      this.byCategory.set(category, new Set());
    }
    this.byCategory.get(category)!.add(actor.id);

    this.logger.push({ level: 'debug', category: 'system:registry', message: `Registered actor ${actor.id} (category: ${category})`, ts: Date.now() });
  }

  /**
   * Unregister an actor from the registry.
   */
  public unregister(id: string): void {
    const actor = this.actors.get(id);
    if (!actor) return;

    this.actors.delete(id);

    const category = actor.category as ActorCategory;
    const categorySet = this.byCategory.get(category);
    if (categorySet) {
      categorySet.delete(id);
      if (categorySet.size === 0) {
        this.byCategory.delete(category);
      }
    }

    this.logger.push({ level: 'debug', category: 'system:registry', message: `Unregistered actor ${id}`, ts: Date.now() });
  }

  /**
   * Get actor by ID.
   */
  public get(id: string): Actor | undefined {
    return this.actors.get(id);
  }

  /**
   * Query actors by filter criteria.
   */
  public query(filter: ActorQuery): Actor[] {
    let results = Array.from(this.actors.values());

    if (filter.category) {
      const categoryIds = this.byCategory.get(filter.category) || new Set();
      results = results.filter(a => categoryIds.has(a.id));
    }

    if (filter.ids && filter.ids.length > 0) {
      const idSet = new Set(filter.ids);
      results = results.filter(a => idSet.has(a.id));
    }

    return results;
  }

  /**
   * Get all actors of a specific category.
   */
  public getByCategory(category: ActorCategory): Actor[] {
    const ids = this.byCategory.get(category) || new Set();
    return Array.from(ids).map(id => this.actors.get(id)!).filter(Boolean);
  }

  /**
   * Update all actors in the registry.
   * @param delta Time elapsed since last frame (ms)
   */
  public update(delta: number): void {
    for (const actor of this.actors.values()) {
      actor.update(delta);
    }
  }

  /**
   * Draw/refresh all actors.
   */
  public draw(): void {
    for (const actor of this.actors.values()) {
      actor.draw();
    }
  }

  /**
   * Get snapshot of all actors for UI consumption.
   */
  public snapshot(): ActorSnapshot[] {
    return Array.from(this.actors.values()).map(actor => ({
      id: actor.id,
      type: actor.type,
      category: actor.category as ActorCategory,
      kind: (actor.constructor.name.replace('Actor', '').toLowerCase() || 'unknown') as any,
      position: actor.getGridPosition(), // Returns grid coords {row, col}
      state: {},
      visible: true
    }));
  }

  /**
   * Clear all actors (for scene cleanup).
   */
  public clear(): void {
    this.actors.clear();
    this.byCategory.clear();
    this.logger.push({ level: 'info', category: 'system:registry', message: 'Actor registry cleared', ts: Date.now() });
  }

  /**
   * Get count of registered actors.
   */
  public count(): number {
    return this.actors.size;
  }

  /**
   * Get count by category.
   */
  public countByCategory(category: ActorCategory): number {
    return this.byCategory.get(category)?.size ?? 0;
  }
}

// Singleton instance
export const actorRegistry = new ActorRegistry();
