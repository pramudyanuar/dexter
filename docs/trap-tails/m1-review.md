# Trap Tails M1 review

## Play the prototype

Open **Trap Tails** in the Dexter catalogue or visit `/games/trap-tails`. Use **A/D** or the arrow keys to move, **Space/W/Up** to jump, and **Shift** to sprint. Hold jump for height. Push into a wall while falling to slide, then press jump again to kick away. **R** resets the selected starting point and **Escape** or **P** pauses. The camera button locks a wide view.

The workshop has an entrance, wall, lift, and finish checkpoint. Rusty Orchard has a sparse board and fixed 12- and 25-piece fixtures for movement and composition review. The sparse board leaves the main gap open for a later construction phase. The populated fixtures can be finished. Springs, conveyors, lifts, one-way shelves, and rail or stationary saws use the same code in every fixture.

## Evidence

The [M0 integration audit](integration-audit.md) records the existing stack, room and signaling constraints, and clean baseline. The [art notes](art/LICENSES.md) document the sprite atlas, artwork source, and prompts. All screenshots and the recording come from a running Chrome session.

- [Sparse orchard](qa/01-sparse.webp)
- [12-piece orchard](qa/02-twelve-pieces.webp)
- [25-piece orchard](qa/03-twenty-five-pieces.webp)
- [Wall slide](qa/04-wall-slide.webp) and [wall kick](qa/05-wall-kick.webp)
- [Movement recording](qa/movement.webm) covering a jump with direction reversal, landing, wall movement, the lift, death/reset, and finish. The recording is 16.6 seconds at 1280 × 720.

## Movement

Logic steps at 60 Hz. The renderer interpolates position and moving equipment between ticks. The fixed-step tests replay the same inputs at simulated 30, 60, and 120 Hz render cadences. The input hold test measures a full jump at 1.925 world units and 0.35 s to the apex. The controller reaches 8 world units/s in sprint and caps a wall slide at 2.8 world units/s. These measurements describe Trap Tails. No commercial-game timing trace was available for the PRD's ±15% comparison.

M1 changes that came from testing include shortening the workshop's taller shaft wall so the spring route clears it. A deterministic replay from the entrance now reaches the goal through the workshop. Exploratory input searches also reached the goal with both populated orchard fixtures. The saw is a swept disk, and simultaneous lethal and goal contact resolves as a death. The lift carries riders and resolves trapping against another solid.

## Verification

`pnpm typecheck`, `pnpm lint:strict`, `pnpm test --runInBand`, and `pnpm build` passed locally. Jest ran 1,324 tests across 102 suites. Fourteen Trap Tails checks cover movement, obstacles, a workshop replay, fixture counts, camera framing, and atlas bounds.

Headless Chrome 158 on the production build verified catalogue navigation and thumbnail loading, all fixtures, pause/resume, movement, wall slide and kick, death/reset, finish, leave confirmation, and recovery from a forced WebGL loss. Four WebGL loss events were observed across the explicit loss and three route exits. The stage held its 16:9 ratio in 1280 × 720, 1920 × 1080, 1366 × 768, 1280 × 960, and 1920 × 800 viewports.

Four-second samples at 1280 × 720 and device pixel ratio 1 on a Core i7-12700H Windows machine:

| Renderer                      | Fixture   | Observed FPS | p95 frame interval |
| ----------------------------- | --------- | -----------: | -----------------: |
| Intel Iris Xe via Direct3D 11 | Workshop  |        161.5 |             6.2 ms |
| Intel Iris Xe via Direct3D 11 | 25 pieces |        165.0 |             6.2 ms |
| SwiftShader software WebGL    | Workshop  |         39.2 |            36.4 ms |
| SwiftShader software WebGL    | 25 pieces |         38.7 |            36.4 ms |

The SwiftShader run averaged 56 draw calls per workshop frame and 83 per dense frame. Chrome reported about 16 MB and 15 MB of JS heap respectively. These are headless browser samples of the solo prototype. The two arena textures total 387,720 bytes on disk. Resource Timing reported 1,012,420 transferred resource bytes in the catalogue-to-practice session, including the catalogue assets and shared chunks. Document navigation bytes are outside that counter.

## Section 14.6 review

Scores are an implementation self-review on the PRD's 0–3 scale. Owner signoff is pending.

| Dimension    | M1 score | Observation                                                                                                                           |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Composition  | 3        | A roughly 50 px runner at 720p in the wide framing. The station, cistern, and negative space anchor the board at its three densities. |
| Background   | 3        | Muted gouache-style scenery and separate cloud planes. Follow mode exposes their parallax.                                            |
| Objects      | 2        | Wood grain, rivets, teeth, coils and rollers are visible. The fixtures use a subset of the planned object catalogue.                  |
| Animals      | 2        | One original layered Miso rig. Poses cover idle, run, sprint, rise, apex, fall, wall slide, kick, landing, death, and finish.         |
| Construction | 0        | The 12- and 25-piece boards are fixed fixtures. Placement and draft are M2 work.                                                      |
| Feedback     | 2        | Squash, expressions, particles, and terminal prompts respond to the simulation. Original audio and scoring UI are later milestones.   |

The next milestone depends on reviewing M1. Hub, draft/build, scoring, multiplayer, audio, gamepad, touch, and Vercel match testing remain outside this prototype.
