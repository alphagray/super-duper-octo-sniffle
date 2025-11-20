/**
 * ActorFactory generates unique IDs and creates typed actor instances.
 * ID format: actor:<type>-<counter> (e.g., actor:fan-0, actor:vendor-1, actor:section-A)
 */

type ActorType = 'fan' | 'vendor' | 'mascot' | 'section' | 'row' | 'seat' | 'wave' | 'waypoint' | 'zone' | 'stairs' | 'ground' | 'skybox';

export class ActorFactory {
  private static counters: Map<ActorType, number> = new Map();

  /**
   * Generate unique ID for actor type.
   * @param type Actor type (fan, vendor, section, etc.)
   * @param customSuffix Optional custom suffix instead of counter (e.g., 'A' for section-A)
   */
  public static generateId(type: ActorType, customSuffix?: string | number): string {
    if (customSuffix !== undefined) {
      return `actor:${type}-${customSuffix}`;
    }

    const count = this.counters.get(type) ?? 0;
    this.counters.set(type, count + 1);
    return `actor:${type}-${count}`;
  }

  /**
   * Reset all counters (useful for tests or scene transitions)
   */
  public static reset(): void {
    this.counters.clear();
  }

  /**
   * Get current count for a type (useful for debugging)
   */
  public static getCount(type: ActorType): number {
    return this.counters.get(type) ?? 0;
  }
}
