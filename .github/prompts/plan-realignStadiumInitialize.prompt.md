## Plan: Realign Stadium Initialization to Actor-First, Data-Driven Architecture

This plan will realign the codebase to the intended actor-first, grid-driven, minimal-manager architecture, with all stadium/section/seat/fan/vendor initialization and layout coming from `LevelService` and `LevelData`. Section and seat creation, positioning, and labeling will be handled by their respective actors, not the scene. All grid positions and dimensions will be data-driven and mockable for now.

### Steps
1. Refactor `LevelService` to provide mock `LevelData` for sections, seats, fans, and vendors, including grid boundaries and labels.
2. Update `StadiumScene` to delegate all section/seat/fan/vendor creation to `LevelService` and actors; remove direct initialization logic.
3. Refactor `SectionActor` to:
   - Accept section data (boundaries, label, etc.) from `LevelService`
   - Create and position `SeatActor` children based on section grid boundaries
   - Calculate label position from grid boundaries
4. Refactor `Seat` to be an `Actor` subclass, responsible for:
   - Handling collision with `WaveSprite`
   - Polling its fan (if present) for wave participation
   - (Optionally) rendering unique seat sprites
5. Ensure all stadium layout, seat/fan/vendor population, and label placement is data-driven and grid-based, not hardcoded in scenes.
6. Remove any remaining seat/row/section initialization or label logic from `StadiumScene` and move to actors or data layer.

### Further Considerations
1. Should `LevelService` also mock up fan assignments to seats, or should that be handled by `SectionActor` after seat creation?
2. Confirm if all label/text rendering should be handled by actors, or if a UI overlay system is needed for dynamic updates.
3. Review and clean up any legacy manager or scene logic that bypasses the new data-driven, actor-first flow.
