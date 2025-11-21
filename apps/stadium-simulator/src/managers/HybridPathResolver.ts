/**
 * Deprecated HybridPathResolver stub.
 * Original navigation-graph implementation was removed in favor of GridPathfinder.
 * This stub remains temporarily so legacy imports compile during the refactor.
 */
export class HybridPathResolver {
  public getGraph(): null {
    return null;
  }

  public rebuildGraph(): void {
    // no-op
  }

  public planPath(): never[] {
    return [];
  }
}
