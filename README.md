# Next.js + Tailwind CSS + TypeScript Starter and Boilerplate

<div align="center">
  <h2>🔋 ts-nextjs-tailwind-starter</h2>
  <p>Next.js + Tailwind CSS + TypeScript starter packed with useful development features.</p>
  <p>Made by <a href="https://theodorusclarence.com">Theodorus Clarence</a></p>

[![GitHub Repo stars](https://img.shields.io/github/stars/theodorusclarence/ts-nextjs-tailwind-starter)](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter/stargazers)
[![Depfu](https://badges.depfu.com/badges/fc6e730632ab9dacaf7df478a08684a7/overview.svg)](https://depfu.com/github/theodorusclarence/ts-nextjs-tailwind-starter?project_id=30160)
[![Last Update](https://img.shields.io/badge/deps%20update-every%20sunday-blue.svg)](https://shields.io/)

</div>

## Features

This repository is 🔋 battery packed with:

- ⚡️ Next.js 16 with App Router
- ⚛️ React 19
- ✨ TypeScript
- 💨 Tailwind CSS 4 — Configured with CSS Variables to extend the **primary** color
- 💎 Pre-built Components — Components that will **automatically adapt** with your brand color, [check here for the demo](https://tsnext-tw.thcl.dev/components)
- 🃏 Jest — Configured for unit testing
- 📈 Absolute Import and Path Alias — Import components using `@/` prefix
- 📏 ESLint — Find and fix problems in your code, also will **auto sort** your imports
- 💖 Prettier — Format your code consistently
- 🐶 Husky & Lint Staged — Run scripts on your staged files before they are committed
- 🤖 Conventional Commit Lint — Make sure you & your teammates follow conventional commit
- ⏰ Release Please — Generate your changelog by activating the `release-please` workflow
- 👷 Github Actions — Lint your code on PR
- 🚘 Automatic Branch and Issue Autolink — Branch will be automatically created on issue **assign**, and auto linked on PR
- 🔥 Snippets — A collection of useful snippets
- 👀 Open Graph Helper Function — Awesome open graph generated using [og](https://github.com/theodorusclarence/og), fork it and deploy!
- 🗺 Site Map — Automatically generate sitemap.xml
- 📦 Expansion Pack — Easily install common libraries, additional components, and configs.

See the 👉 [feature details and changelog](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter/blob/main/CHANGELOG.md) 👈 for more.

You can also check all of the **details and demos** on my blog post:

- [One-stop Starter to Maximize Efficiency on Next.js & Tailwind CSS Projects](https://theodorusclarence.com/blog/one-stop-starter)

## Getting Started

### 1. Clone this template using one of the three ways

1. Use this repository as template

   **Disclosure:** by using this repository as a template, there will be an attribution on your repository.

   I'll appreciate if you do, so this template can be known by others too 😄

   ![Use as template](https://user-images.githubusercontent.com/55318172/129183039-1a61e68d-dd90-4548-9489-7b3ccbb35810.png)

2. Using `create-next-app`

   ```bash
   pnpm create next-app  -e https://github.com/theodorusclarence/ts-nextjs-tailwind-starter ts-pnpm
   ```

   If you still want to use **pages directory** (_is not actively maintained_) you can use this command

   ```bash
   npx create-next-app -e https://github.com/theodorusclarence/ts-nextjs-tailwind-starter/tree/pages-directory project-name
   ```

3. Using `degit`

   ```bash
   npx degit theodorusclarence/ts-nextjs-tailwind-starter YOUR_APP_NAME
   ```

4. Deploy to Vercel

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https%3A%2F%2Fgithub.com%2Ftheodorusclarence%2Fts-nextjs-tailwind-starter)

### 2. Install dependencies

It is encouraged to use **pnpm** so the husky hooks can work properly.

```bash
pnpm install
```

### 3. Run the development server

You can start the server using this command:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The home URL redirects to the games catalog in `src/app/games/page.tsx`.

### 4. Change defaults

There are some things you need to change including title, urls, favicons, etc.

Find all comments with !STARTERCONF, then follow the guide.

Don't forget to change the package name in package.json

### 5. Commit Message Convention

This starter is using [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/), it is mandatory to use it to commit changes.

## Struktur Dexter

| Folder                                      | Isi                                                          |
| ------------------------------------------- | ------------------------------------------------------------ |
| `src/app/`                                  | Route halaman, API, dan layout Next.js                       |
| `src/features/`                             | Komponen, logika, penyimpanan, dan tes per fitur             |
| `src/components/`, `src/hooks/`, `src/lib/` | UI, hook, dan utilitas yang dipakai lintas fitur             |
| `src/constants/`, `src/styles/`             | Konfigurasi aplikasi dan gaya global                         |
| `src/integrations/supabase/`                | Klien Supabase untuk browser dan server serta akses Postgres |
| `supabase/migrations/`, `supabase/scripts/` | Migration SQL dan skrip impor data lama                      |
| `public/`, `scripts/`                       | Aset publik dan skrip pemeliharaan                           |

## Database Dexter (Supabase)

Dexter memakai satu proyek Supabase untuk penyimpanan server. Postgres menyimpan ruang multiplayer, chat room, signaling, antrean Snake Duel, leaderboard, Paste, laporan bug, dan konfigurasi admin. Supabase Storage menyimpan file di bucket privat `dexter-transfer`. Notes, riwayat chat AI, dan preferensi pribadi tetap tersedia di browser tempat data itu dibuat.

1. Di **Supabase → SQL Editor**, jalankan [migration SQL](supabase/migrations/) berdasarkan urutan nama file. Lewati migration yang sudah berhasil dijalankan. Migration membuat tabel server dengan RLS, menjadwalkan pembersihan data kedaluwarsa bila Supabase Cron tersedia, dan membuat bucket transfer privat.
2. Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY` dari proyek yang sama. Simpan secret key hanya di environment server. Pengembangan lokal membaca `.env.local`. Deploy membaca environment Vercel.
3. Jalankan ulang `pnpm dev` atau redeploy. Cek pembuatan room, leaderboard, Paste, dan upload/unduh di `/send`. Untuk transfer file, konfigurasikan juga `CHAT_TOTP_SECRET` seperti sebelumnya.

Di Supabase Free, batas upload Dexter adalah 50 MB per file. Pada paket berbayar, samakan `SUPABASE_TRANSFER_MAX_BYTES` dengan batas bucket di dashboard. Aplikasi mendukung hingga 200 MiB per file. File hilang dari daftar setelah 24 jam dan dibersihkan saat penyimpanan transfer dibuka. [Batas upload Supabase](https://supabase.com/docs/guides/storage/uploads/file-limits)

Tanpa secret key, pengembangan lokal memakai memori dan `.data/` untuk fitur yang mendukung mode lokal. Snake Duel membutuhkan Supabase. Login admin dan OTP Dexter memakai sesi aplikasi. Helper dan Proxy Next.js tersedia untuk sesi Supabase Auth.

### Memindahkan data dari penyimpanan lama

Untuk instalasi yang sudah pernah memakai Upstash, [skrip impor](supabase/scripts/import-legacy-storage.mjs) bisa memindahkan leaderboard, Paste, konfigurasi, laporan bug, dan room multiplayer biasa beserta chat serta signaling yang masih aktif. Jalankan migration SQL dulu. Simpan URL dan token Upstash lama di `.env.migration.local` menggunakan nama `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN`.

```sh
node --env-file=.env.local --env-file=.env.migration.local supabase/scripts/import-legacy-storage.mjs
```

Perintah tersebut menampilkan jumlah data sumber. Hentikan penulisan ke penyimpanan lama, lalu jalankan kembali dengan `--apply` dan deploy versi baru. Impor dapat dijalankan ulang. Baris yang kuncinya sudah ada di Supabase dipertahankan. Setelah cutover, kredensial Upstash dan Vercel Blob bisa dihapus dari environment deployment.

Mulai lobby dan antrean Snake Duel baru saat cutover. Unduh file Vercel Blob yang masih dibutuhkan sebelum cutover dan unggah kembali ke `/send`. Skrip membaca Upstash saja. Data lokal seperti laporan di `.data/` perlu dipindahkan tersendiri jika ingin dipakai di Supabase.

## Dexter Arcade audit and roadmap

The home route redirects to `/games`. The game library and detail pages share one catalog, while playable pages retain their own URLs. Next.js 16 App Router and React power the web UI. Supabase Postgres holds shared rooms, matchmaking, and leaderboards. Supabase Storage serves file transfer. The project deploys to Vercel, with Snake Duel endpoints assigned to Singapore.

| Existing integration                | Games                                                                                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standard multiplayer room engine    | Connect 4, Suit, Karambol, Uno, Uno Flip, Uno No Mercy, Sekata, Mahjong Hong Kong, Dart, Remi, Poker, Werewolf, Three Monkeys, Battleship, Gomoku, Checkers, Chess, Liar's Dice, Domino, Quiz, Pictionary, and Gelud |
| Separate solo and multiplayer flows | Snake Classic, Snake Harian, and Snake Duel                                                                                                                                                                          |
| Solo pages                          | Wordle, 2048, Minesweeper, Tetris, DOOM, DOOM II, Wolfenstein 3D, Mahjong Solitaire, and Arsip Kartu                                                                                                                 |

The room engine's `GameDef` contract handles start, moves, completion, rematches, capacity, and seat-specific state. The engine validates moves on the server and uses version checks and atomic Postgres writes. Browsers poll room state every second and reuse cached seat credentials when reconnecting. Public and private rooms, host transfers, kicking, leaving, game settings, and minimum-player checks already operate in the engine. Several fixed-capacity games start automatically when full. Snake Duel uses its own WebRTC data channel and server-backed matchmaking. Gelud uses WebRTC for peer gameplay, and Three Monkeys uses WebRTC for voice.

1. **Discovery and details.** Reuse Dexter's art and catalog for categories, search, mode filters, instructions, and links to existing gameplay. Recent and popular shelves derive from actual game openings on the current device. Recommendations use recent categories with curated defaults.
2. **Lobby and presence.** QR invites open the existing game-specific join flow. Add a shared-screen role, avatar selection, ready state, and heartbeat-based presence where that platform role is used. Preserve legacy auto-start tables. Batch public lobby reads before increasing room traffic.
3. **Controller pilot.** Start with Quiz. Issue separate screen and player credentials, project public game state to the shared display, and route phone answers through the existing authoritative move contract. Retain polling as a fallback and measure update latency before adding a real-time transport. The existing WebRTC paths serve games that already need them.
4. **Game adapters and results.** Add Dart and Sekata controls next. For Remi, Werewolf, and Three Monkeys, formally verify each screen and phone projection against the game's hidden information rules. Build rankings and replay controls from server-derived results. Keep Mahjong Solitaire available as a solo game and treat Mahjong Hong Kong as its own multiplayer integration.
5. **Device and deployment tests.** Exercise duplicate and simultaneous inputs, reconnection, private views, keyboard and remote focus, iOS Safari, and Android TV across the supported controller games.

## Snake on Vercel

The Snake page at `/games/snake` includes Classic, Harian, and a shared 1v1 Duel arena. Duel uses Supabase Postgres for room codes, public rooms, matchmaking, and WebRTC setup. The host browser runs the match over a WebRTC data channel, and the duel ends when either player leaves.

- Use Node 24 and the project's pnpm 12 pin. Set `ENABLE_EXPERIMENTAL_COREPACK=1` in Vercel so builds use the pinned package manager.
- Duel uses the shared Supabase environment variables. Its setup endpoints run in Singapore (`sin1`) and use a separate database scope in Vercel Preview.
- For networks that block direct WebRTC traffic, configure the optional TURN relay in `.env.example`.
- Test room links, matchmaking, a round, and leaving from two browsers before deploying to Production.

## Projects using ts-nextjs-tailwind-starter

<!--
TEMPLATE
- [sitename](https://sitelink.com) ([Source](https://github.com/githublink))
- [sitename](https://sitelink.com)
-->

- [theodorusclarence.com](https://theodorusclarence.com) ([Source](https://github.com/theodorusclarence/theodorusclarence.com))
- [Notiolink](https://notiolink.thcl.dev/) ([Source](https://github.com/theodorusclarence/notiolink))
- [NextJs + Materia UI + Typescript](https://github.com/AlexStack/nextjs-materia-mui-typescript-hook-form-scaffold-boilerplate-starter)

Are you using this starter? Please add your page (and repo) to the end of the list via a [Pull Request](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter/edit/main/README.md). 😃

## Expansion Pack 📦

This starter is now equipped with an [expansion pack](https://github.com/theodorusclarence/expansion-pack).

You can easily add expansion such as React Hook Form + Components, Storybook, and more just using a single command line.

<https://user-images.githubusercontent.com/55318172/146631994-e1cac137-1664-4cfe-950b-a96decc1eaa6.mp4>

Check out the [expansion pack repository](https://github.com/theodorusclarence/expansion-pack) for the commands

### App Router Update

Due to App Router update, the expansion pack is currently **outdated**. It will be updated in the future. You can still use them by copy and pasting the files.
