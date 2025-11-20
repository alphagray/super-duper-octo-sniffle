## Plan: Align Wave Logic & Animation with Power/Speed

This plan reviews your proposed wave logic versus the current implementation, evaluates its soundness, and outlines steps to synchronize wave animation speed/intensity with wave power. It also details how to ensure fans are only polled once per wave and how to tie animation parameters to wave strength.

### Steps

1. **Compare Current vs. Proposed Logic**
   - Review current wave participation polling, grid checks, and animation triggers in [`WaveManager.ts`](apps/stadium-simulator/src/managers/WaveManager.ts), [`SeatManager.ts`](apps/stadium-simulator/src/managers/SeatManager.ts), and [`StadiumScene.ts`](apps/stadium-simulator/src/scenes/StadiumScene.ts).
   - Map your described logic (grid-based, single participation check per fan, section aggregate/peer pressure, per-column event emission) to current code.
   - Identify any mismatches (e.g., repeated polling, animation not tied to wave power, etc.).

2. **Assess Soundness of Proposed Logic**
   - Evaluate if your approach (grid-based, single-check, section aggregate, per-column event, animation tied to wave power) is robust and compatible with the event-driven, grid-based architecture.
   - Note any edge cases or architectural concerns (e.g., concurrency, event ordering, state cleanup).

3. **Plan for Wave Speed/Strength-Driven Animation**
   - Define how wave power maps to column traversal speed (e.g., higher power = lower ms/column).
   - Specify how fan animation intensity/speed should scale with wave power and participation (full/partial).
   - Plan code changes: parameterize wave speed in `WaveManager`, pass power/intensity to animation triggers in `StadiumScene`, and update fan animation logic.

4. **Ensure Single Participation Check per Fan per Wave**
   - Confirm or add logic to mark fans as "checked" for the current wave instance.
   - Ensure per-column event only triggers participation logic for unchecked fans.

5. **Update Animation Triggers for Power/Intensity**
   - Adjust event payloads to include wave power/intensity.
   - Update fan animation methods to use these parameters for speed/intensity.

### Further Considerations

1. Should wave power affect both speed (ms/column) and animation intensity, or just one?
2. How should partial participation (not all fans in a column) visually differ from full participation?
3. Should section aggregate/peer pressure be recalculated per column or per section per wave?
