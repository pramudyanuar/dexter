# Trap Tails integration audit

## M0 baseline

Audit date 2026-11-28. Topic branch started from `upstream/main` at `6215fb0` with a clean worktree. Installed Next 16.4.6, Three 0.170.0, Node 22.21.1, and pnpm 11.25.0. The package declares Node 24.x and pnpm 12.0.0. Existing dependencies were used for the baseline.

| Command                 | Result before source changes   |
| ----------------------- | ------------------------------ |
| `pnpm typecheck`        | Passed                         |
| `pnpm lint`             | Passed                         |
| `pnpm test --runInBand` | 101 suites, 1,310 tests passed |
| `pnpm build`            | Passed, including sitemap      |

Read `AGENTS.md` and the installed Next App Router guides for pages, Server and Client Components, metadata, and lazy loading. The game route uses a client boundary for the browser-only Three module. A scan of `src` found no existing Three renderer or orthographic camera. Three is already installed, so the practice spike establishes its own scene and resource lifecycle.

## Existing entry points

- `src/constant/games.ts` exports `GAMES` for the catalogue and `GAME_PAGES` for route lookup. `src/app/games/page.tsx` uses `GameArt` and filters by `online`/`solo`. `src/components/games/GameShell.tsx` supplies the game title, last-played tracking, splash, and report entry point. Trap Tails adds a solo catalogue entry and reuses the full-screen shell.
- `src/components/games/DocumentTitle.tsx`, `RememberGame.tsx`, and `Splash.tsx` run through `GameShell`. `src/components/games/snake/controls` exports `shouldIgnoreGameKey`, used by keyboard-driven solo games to leave native controls and browser shortcuts usable.
- `src/lib/rooms/types.ts` defines `Room` (tokens, host, revision, names, status, private state) and `RoomView` (seat, joined roster, capacity, host, revision and projected state). `src/lib/rooms/game.ts` defines `GameDef`. `src/lib/rooms/games.ts` is the actual online registry. `src/lib/games/karambol.ts` declares two to four seats. Existing host transfer and the default 10 s leave grace in `src/lib/rooms/engine.ts` need game-specific treatment for a browser authority.
- `src/app/api/rooms/route.ts` creates rooms and lists public waiting rooms. `src/app/api/rooms/[code]/route.ts` reads and mutates seats and game state. `seatOf` checks the opaque `x-player-token` against seat slots. Only the server-side record holds the full token list. `toView` filters state by seat. `src/lib/rooms/room-request.ts` attaches tokens as headers, requests fresh data, and propagates HTTP status with server error text. `src/lib/rooms/useRoom.ts` keeps a `RoomSession` and polls views every 1,000 ms. `src/lib/rooms/code-format.ts` uses five ambiguity-free characters. The longer codes and 20–30 s reconnect grace in the PRD need explicit compatibility decisions in M3.
- `src/lib/rooms/store.ts` selects Redis REST from `UPSTASH_REDIS_REST_URL`/`TOKEN` or `KV_REST_API_URL`/`TOKEN`, uses a memory store outside production, and returns unavailable in production without credentials. Room key `room:<code>` holds versioned JSON for two hours. Creation uses `SET NX EX`, and `saveIf` uses Lua CAS. `src/lib/rooms/mutate.ts` retries up to three CAS conflicts. Reuse those operations for lobby metadata and coarse checkpoints in M3.
- `src/app/api/rooms/[code]/signal/route.ts` uses `seatOf` and `voiceOf` to infer one allowed peer. It accepts `hello`, `offer`, `answer`, and `ice`, caps message data at 8,000 characters, and rate-limits sends to 80 per seat per 10 s. The `Signal` record carries `id`, `from`, `to`, `kind`, `data`, and `at`. Redis key `room:<code>:rtc` retains 80 entries for two hours. A signal read fetches the room and list. A write fetches the room, appends, trims, and refreshes TTL. The route needs explicitly authorized per-peer addressing and shorter-lived signaling before reuse for a four-seat host star.
- `src/components/games/gelud/useGeludPeer.ts` uses one reliable data channel and a 750 ms poll loop with online short-circuiting. `src/app/games/gelud/page.tsx` runs host simulation and sends state approximately every 32 ms. `src/components/games/monkeys/useVoice.ts` uses one partner at a time and 700 ms polling for voice. `src/components/games/snake/SnakeDuelConnection.tsx` uses one reliable channel and a 750 ms reservation poll through separate Snake Duel endpoints. Review their teardown, retry, and ICE gathering when implementing M3. `src/lib/rooms/ice-servers.ts` provides Google STUN plus optional `NEXT_PUBLIC_TURN_*`. Production TURN credentials and quotas need dashboard verification.

M1 does not call room, Redis, or signaling APIs. A local environment file was absent. The Vercel CLI was logged out and owner dashboard settings, TURN, and quotas were unavailable from the checkout. The project needs those checks in M3 before any online or cost claim.

## Private reference review

Read the full v3 PRD and implementation prompt. Opened the extracted gallery in Chrome. All 26 images decoded, including R23, R25, and R26 after using the package's optional downloader. Kept the ZIP, extracted gallery, and downloads outside the repository. R01–R09 informed relative silhouette scale, layered scenery, and readable machine shapes. R10–R26 document subsequent milestones. Supplementary sources were the [publisher press kit](https://www.cleverendeavourgames.com/uch-press-kit), [official Steam gallery](https://store.steampowered.com/app/386940/Ultimate_Chicken_Horse/), and [UI archive](https://interfaceingame.com/games/ultimate-chicken-horse/). Trap Tails uses its own course, interface, artwork, and character rig. No external game code or asset was incorporated.
