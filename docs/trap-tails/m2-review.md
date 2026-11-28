# Trap Tails M2 review

Open `/games/trap-tails`. Choose **Lab jebakan** from the course menu to try the new mechanisms without a match. The lab provides starting points for the launcher, fan and spring, piston, and swinging weight. Choose **Party lokal** from the game header or jump near the workshop's **PARTY [E]** sign and press **E**.

## Party prototype

Two to four players share one keyboard and one camera. The first two seats use **A/D/W/left Shift** and the **arrow keys/right Shift**. Seats three and four use the **J/L/I/U** and **numeric keypad** sets shown in setup. In the crate, use left/right to browse, jump to claim, and down to pass. In the blueprint, use each seat's direction keys and sprint key to move and rotate. Confirm with **F**, **/**, **O**, or **numpad Enter**. Mouse controls and focusable placement buttons are available as alternatives.

The round uses a seeded contested crate, a persistent board, protected start and goal zones, a 3-second countdown, a 45-second race, and event-coded cumulative scores. Two-seat matches can enable a second crate. Ties enter sudden death with respawns and a two-attempt limit. The result uses a 600-point and ten-round default, with setup choices for both.

All 12 P0-A items from the PRD are playable. The fan, timed boxing piston, and swinging weight bring the catalogue to 15. Bolts stop at solid terrain. Spikes and launchers can follow a lift. A demolition parcel removes overlapping player objects and their attachments together. Coin pickup is exclusive per race and resets for the next race. Each mechanism is deterministic at the fixed simulation tick.

The shared-keyboard adapter processes key claims in event order. The active selection rotates by round and crate. The orchard starts with a traversable route so the first playtest can use varied trap placements and score immediately. Docking points snap to compatible terrain faces. Springs launch off the rotated face. One-way shelves and lifts keep an upright orientation.

## Visual evidence

- [Trap lab](qa/m2/01-trap-lab.webp) and [four-seat setup](qa/m2/02-local-setup.webp)
- [Closed crate](qa/m2/03-closed-crate.webp) and [open crate](qa/m2/04-open-crate.webp)
- [Blueprint with four cursors](qa/m2/05-blueprint.webp), [countdown](qa/m2/06-countdown.webp), and [four-racer arena](qa/m2/07-four-racers.webp)
- [No-finish scoreboard](qa/m2/08-score-no-finishers.webp) and [recorded Party round](qa/m2/party-flow.webm)

M2 visual self-review on the PRD's 0–3 scale. Composition 3, background 3, objects 3, animals 2, construction 3, feedback 2. The atlas adds a painted toolbox, orchard-themed mechanisms, and Pip's articulated fox silhouette. Local seats three and four reuse Miso and Pip with colors and number markers. Construction uses the same textures as the field and adds bounds hatching, validity markers, mounting, and motion previews. Match feedback includes a score ledger and visual telegraphs. Owner sign-off, the full four-animal set, and custom audio are pending.

## Verification

Local production build, strict ESLint, TypeScript, and changed-file Prettier checks passed. Jest passed 1,356 tests across 103 suites, including 46 Trap Tails tests. They exercise shared and stale claims, placement persistence, every catalogue entry and allowed orientation, collision and scoring invariants, coin reset, and the bounded tiebreak.

Chrome drove the production build at 1280 × 720 on Windows. The test opened the lab, drafted with four keyboard seat mappings, placed with the mouse, started the shared race, reached a no-finish result, and entered the next draft. It also verified pause, leave confirmation, and return to practice. The closed-crate screenshot holds the live reveal briefly for a clear capture.

## Remaining milestone work

M2 covers local mechanical validation. Online rooms, deployed match verification, NAT/TURN, and Redis remain M3 work. The full hub, additional themed arenas, advanced objects, original audio, and expanded rule settings remain planned milestones. The draft PR uses the existing topic branch and targets upstream `main`.
