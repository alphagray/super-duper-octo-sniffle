## Personality Integration Refactor (Sub-Plan)

### Goals
- Actors (e.g., `VendorActor`, `MascotActor`) are responsible for creating and managing their sprites and personalities.
- `PersonalityIntegrationManager` becomes a service for fetching/assigning personalities, not for creating sprites.
- No direct sprite creation in the manager; all instantiation and wiring happens in the actor layer.
- Personality data and helper methods move into the actor classes, with the manager providing lookup and content loading only.

### Steps
1. **Service Refactor**
	- Remove all sprite creation methods (`createVendor`, `createMascot`) from `PersonalityIntegrationManager`.
	- Expose only methods for loading, retrieving, and querying personalities (e.g., `getVendorPersonalityByIndex`, `getVendorPersonalityById`, `getRandomVendorPersonality`).

2. **Actor Refactor**
	- In `VendorActor` and `MascotActor`, add logic to:
	  - Query the manager for a personality (by index, id, or random).
	  - Pass the personality to the sprite constructor when creating the sprite.
	  - Store a reference to the assigned personality in the actor for later use (UI, dialogue, etc).
	  - Provide helper methods for personality-driven behavior or UI (e.g., `getPersonalityName()`).

3. **Scene/Manager Integration**
	- When creating actors in the scene or AI manager, pass any required personality selection info (index, id, etc) to the actor constructor.
	- Do not create sprites directly in the scene or manager; always let the actor handle sprite instantiation.

4. **Cleanup & Documentation**
	- Remove any remaining direct sprite creation from `PersonalityIntegrationManager`.
	- Update documentation to reflect the new flow: scene/manager → actor (personality fetch + sprite creation) → sprite.
	- Add comments and usage examples for the new service-oriented manager API.

5. **Testing & Validation**
	- Ensure that all vendors and mascots in the main game are assigned personalities via the new flow.
	- Confirm that UI and dialogue features correctly reflect assigned personalities.

---
# Vendor Targeting & UI Refinement Plan

## Overview
We will refine vendor-related UI and interaction elements WITHOUT introducing thirst-based fan scoring yet. Focus areas:
1. Reticle validity normalization (consistent red/green feedback for all vendors)
2. Dynamic section highlight aligned to actual SectionActor bounds
3. Personality name injection into vendor control buttons (fallback ArchetypeKey #<displayIndex>)
4. Arrival trigger specification (for future logic): vendor considered "arrived" when within 10% of tile cell center radius

## Out of Scope (Explicitly Deferred)
- Thirst or happiness-based fan target scoring
- Cursor proximity weighting or bias
- Vendor behavioral state changes on arrival (will use spec later)

## Goals & Acceptance Criteria
| Goal | Acceptance Criteria |
|------|---------------------|
| Reticle normalization | Hovering invalid target shows red crosshair consistently for vendor 0 and 1. Valid seats/sections show green; no silent failures. |
| Dynamic highlight | Highlight rectangle matches visible section boundaries (seats area) without offset drift at varying resolutions. |
| Personality labels | Each vendor button displays `PersonalityName` OR fallback `ArchetypeKey #<1-based-index>`; no raw numeric ID alone. |
| Arrival trigger doc | Plan & AI config doc contain clear definition: "arrived if distance to target cell center <= 0.1 * cellSize". |

## Phases
### Phase 1: Planning & Clarifications
- Confirm method to compute section bounds (aggregate seat actors vs existing dimensions).
- Determine personality fallback source (archetype key list or in-code constant).
- Verify existing functions to access vendor personality (e.g., `vendorActor.getVendor().personality`).

### Phase 2: Dynamic Highlight Refactor
- Replace hardcoded pixel offsets in `highlightSection`.
- Use grid manager (`gridToWorld`) to compute top-left & bottom-right from section's first & last seat cells (or provided section rows metadata).
- Render fill & stroke using derived bounds; test alignment visually.
- IMPLEMENTED: `TargetingReticle.highlightSection` now derives bounds from seat ranges (cols & rows) and `gridToWorld` + `cellSize`.

### Phase 3: Reticle Validity Normalization
- Audit `handlePointerMove` & associated validity checks.
- Ensure vendor targeting mode sets unified listeners for all vendors.
- Add explicit invalid cases: outside grid, seat occupied (if available), non-targetable zone.

### Phase 4: Personality Label Injection
- On vendor spawn or UI rebuild: fetch personality name.
- If missing: derive fallback label `ArchetypeKey #<index+1>`.
- Update button text and any related ARIA/tooltip attributes.

### Phase 5: Arrival Trigger Documentation
- Insert arrival trigger spec in this plan & append to `AI_CONFIGURATION.md`.
- AddTODO marker near future logic integration site (NOT implementing behavior now).

### Phase 6: Final Review & Sign-off
- Present summary of changes for user review.
- Mark corresponding TODOs completed after approval.

## Implementation Notes
- Keep changes surgical: avoid unrelated refactors.
- No introduction of new scoring functions.
- All magic numbers (e.g., 0.1 center tolerance) documented here; not placed into `gameBalance.ts` until used in behavior.

## Pending Clarifications (Need User Input)
1. Section bounds source: Should we aggregate from seat actors, use stored width/height in `SectionActor`, or a precomputed bounding box method if present?
2. Personality fallback: Confirm list of archetype keys or prefer generic prefix `Vendor`? (Current plan: archetype key.)
3. Seat occupancy validity: Do we currently have an API to check if a seat is already targeted/occupied for reticle invalid state, or skip for now?

## Tracking
We will mark phases complete only after explicit user sign-off.

- Phase 1 Status: COMPLETE
- Phase 2 Status: AWAITING REVIEW (IMPLEMENTED)
- Phase 3 Status: PENDING
- Phase 4 Status: PENDING
- Phase 5 Status: PENDING
- Phase 6 Status: PENDING

---
*Last updated: initial creation*
