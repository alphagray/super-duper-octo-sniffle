## Plan: Fan-Level Stats & Vendor Pathfinding

Refactoring the architecture to make fans the atomic unit with their own stats, while sections aggregate those stats. This enables vendors to pathfind to individual thirsty fans with comical running animations and logical service behavior.

### Architecture Shift: Fan-Level Stats

#### Current State
- **Section** has happiness/thirst/attention stats
- **Fans** are visual-only, with intensity based on section aggregates

#### New State
- **Each Fan** has its own happiness/thirst/attention stats
- **Section** aggregates fan stats for wave calculations
- **Vendors** target individual high-thirst fans

### Implementation Steps

1. **Add stats to Fan class**
   - Add private properties: `happiness`, `thirst`, `attention`
   - Add getter methods: `getStats()`, `getThirst()`, `getHappiness()`, `getAttention()`
   - Add `drinkServed()` method for vendor interaction (reduces thirst, increases happiness)
   - Add `updateStats(deltaTime)` method so fans get thirstier over time
   - Initialize fans with random starting stats for variety

2. **Update Section to aggregate fan stats**
   - Add `getAggregateStats()` method in `StadiumSection`
   - Calculate average of all fan stats across all rows
   - Return as `{ happiness, thirst, attention }`
   - Use aggregates for wave success calculations

3. **Update GameStateManager integration**
   - Keep section-level stat tracking for backwards compatibility
   - Have `GameStateManager.updateStats()` call each section's aggregate
   - Update `calculateWaveSuccess()` to use aggregated fan stats
   - Consider removing section-level stats entirely in favor of pure aggregation

4. **Create visual Vendor sprite**
   - Refactor `Vendor.ts` from simple sprite to container (like Fan)
   - Add visual components: body, head, maybe drink tray
   - Implement animation states: idle, running, serving
   - Add depth/layering so vendors appear in front of fans

5. **Implement vendor movement & pathfinding**
   - Add position tracking to VendorManager vendors
   - Implement simple row-by-row navigation within a section
   - Add "running" animation when vendor is assigned to section
   - Add "serving" animation when vendor reaches a fan
   - Use Phaser tweens for smooth movement between positions

6. **Vendor target selection logic**
   - Use `SeatManager` to query fans by thirst level
   - Vendor targets specific seats, not just sections
   - Simple greedy algorithm: serve highest-thirst fan in current row, then move to next row
   - Track vendor's current row/seat position

7. **VendorManager pathfinding integration**
   - Update `placeVendor()` to set initial position and target section
   - Add `getTargetFan()` method to find next fan to serve
   - Update `update()` to move vendors toward targets and serve them
   - Handle service completion: reduce fan thirst, move to next target
   - Return to idle when all fans in section are served

8. **Update StadiumScene vendor integration**
   - Create visual Vendor sprites when VendorManager emits `vendorPlaced`
   - Position vendors at section entrance or edge
   - Animate vendor movement as they pathfind to fans
   - Show visual feedback during service (drink icon, etc.)
   - Clean up vendor sprites when service is complete

### Design Decisions to Make

1. **Fan stat decay**
   - All fans get thirstier at same rate, or vary by randomness?
   - Should intensity (jiggle) affect thirst rate?
   - Should wave participation affect stats?

2. **Vendor capacity**
   - Unlimited drinks per vendor?
   - Limited capacity requiring "restock" trips?
   - Different vendor types (drinks vs snacks)?

3. **Vendor visual design**
   - Simple sprite with animations?
   - Container with multiple parts (like Fan)?
   - Distinct appearance (carrying tray, uniform)?

4. **Pathfinding complexity**
   - Simple row-by-row in order?
   - Target highest-thirst fans first (greedy)?
   - Realistic path through aisles between rows?
   - Collision avoidance with other vendors?

5. **Service timing**
   - Instant service when vendor reaches fan?
   - Animated service (1-2 seconds per fan)?
   - Multiple fans per service stop?

6. **Vendor positioning**
   - Start at section edge/entrance?
   - Teleport to section then navigate rows?
   - Move between sections through aisles?

### Recommended Approach

**Phase 1 - Fan Stats:**
- Add stats to Fan with random initialization
- Implement stat decay over time
- Update Section aggregation
- Test that existing gameplay still works

**Phase 2 - Vendor Visuals:**
- Create Vendor container sprite (similar to Fan)
- Add idle/running/serving animation states
- Position vendors in scene when assigned

**Phase 3 - Basic Pathfinding:**
- Simple row-by-row navigation
- Target highest-thirst fans within current row
- Move to next row when current row is served

**Phase 4 - Polish:**
- Add running animation when assigned
- Smooth movement tweens between positions
- Service animations with visual feedback
- Comical touches (vendors bump into things, run frantically, etc.)

### Open Questions

1. Should fan stats affect wave participation chance individually, or only through section aggregates?
2. Should vendors have personalities/speeds (fast vendor, slow vendor)?
3. Should there be vendor-fan interactions beyond service (fans wave at vendors, etc.)?
4. Should vendors affect attention stat (fans distracted by vendor) as well as thirst?
5. What happens if vendor is serving during a wave? Does it interfere more/less?
