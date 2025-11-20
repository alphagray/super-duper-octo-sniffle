## Plan: Actor-First, Grid-Driven, Minimal-Manager Architecture

**TL;DR:**  
Actors are the primary game objects, each with grid-based position/state. Sprites are rendering details, updated by actors via GridManager. Managers are minimized: only GameStateManager, WaveManager, AIManager (formerly VendorManager), and GridManager remain. SeatManager and SectionManager are removed. All seat/fan/section population will be data-driven in the future.

### Steps
1. **Remove SeatManager and SectionManager**
   - Delete both files; move any needed seat/row logic to SectionActor or data loader.
2. **Actors use grid coordinates as primary position**
   - Refactor Actor base class to store `gridRow`, `gridCol` (not world x/y).
   - Add `getWorldPosition()` helper using GridManager.
   - On movement, update grid coords and call GridManager to update sprite position if present.
3. **SectionActor handles seat/fan population**
   - SectionActor creates/populates seats/fans from data (mocked for now, API-driven later).
   - Handles all seat/fan queries for AI, wave, etc.
4. **Managers: Only keep GameStateManager, WaveManager, AIManager, GridManager**
   - AIManager handles all AI (vendors, mascots, etc.), coordinates with GridManager for pathfinding.
   - GameStateManager: session, scoring, section stats.
   - WaveManager: wave lifecycle, event emission.
   - GridManager: spatial logic, pathfinding, collision, world<->grid conversion.
5. **Actors update sprites via GridManager**
   - When an actor moves, it updates its grid coords and asks GridManager to update its sprite (if any).
   - Non-visual actors skip sprite update.
6. **StadiumScene: Actor-first initialization**
   - Scene creates managers, then actors (from data), registers actors, wires up events.
   - No direct sprite creation in scene; all through actors.

### Further Considerations
1. **Data-driven population**: When backend/API is ready, SectionActor will load seat/fan data from API, not hardcoded.
2. **GridManager as single source of spatial truth**: All spatial queries, pathfinding, and collision go through GridManager.
3. **AIManager extensibility**: Handles all AI actors, not just vendors; future-proof for mascots, etc.

**Questions for you:**  
- Should SectionActor own the logic for both seat/fan creation and seat/fan queries, or should there be a separate utility for querying all seats/fans across the stadium (for AI targeting)?
- Any other manager or system you think should be kept or removed for this new architecture?
