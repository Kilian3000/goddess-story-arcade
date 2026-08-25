# Goddess Story Arcade

[![CI](https://github.com/Kilian3000/goddess-story-arcade/actions/workflows/ci.yml/badge.svg)](https://github.com/Kilian3000/goddess-story-arcade/actions/workflows/ci.yml)

A neutral, browser-based Goddess Story booster arcade. It recreates pack collation instead of drawing every card from one flat rarity pool, then wraps the opening in responsive animation, synthesized audio, and two booster-winning side games.

This repository is deliberately independent from any production brand, domain, tracker, or server. It works from a bundled local card-library snapshot, while deployments can replace that source through a small configuration boundary.

> **18+ fan project.** The interface and artwork may contain mature or suggestive material.

## What is included

- **Open Packs** — 47 booster configurations across 1, 2, 5, 10, and 20 yuan products.
- **Physical-style collation** — ordered rarity lanes, per-box state where useful, and no duplicate card ID inside one pack.
- **Tactile reveals** — tearing, swiping, rarity reactions, keyboard/touch controls, and a low-latency Web Audio soundtrack.
- **Waifu 21** — blackjack against a rotating dealer, with better booster prizes for stronger hands.
- **Heartlock** — tiered timing duels against 12 adult opponents, with progression and recovery matches.
- **Local progress** — opened-pack counts and game state stay in the browser; there is no account or server database.
- **Self-contained card library** — 7,013 catalog records and their card/set artwork are bundled under `public/card-data`, so a clone works without a tracker or external image host.

## Run locally

Requirements: Node.js **22.13 or newer** and npm.

```bash
git clone https://github.com/Kilian3000/goddess-story-arcade.git
cd goddess-story-arcade
npm ci
npm run dev
```

Open `http://localhost:3000`. No `.env` file, external card server, API key, or password is required. Copy `.env.example` only when you intentionally want to override the neutral branding or card-data paths for a deployment.

Useful commands:

```bash
npm run dev      # local development server
npm test         # engine tests, audio contracts, production build, rendered HTML tests
npm run lint     # ESLint
npm run build    # production build only
```

## Configuration

All integration values are build-time `NEXT_PUBLIC_*` settings:

| Variable | Neutral default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_ARCADE_TITLE` | `Goddess Story Arcade` | Browser and social title |
| `NEXT_PUBLIC_ARCADE_BRAND_LEAD` | `GODDESS` | First wordmark segment |
| `NEXT_PUBLIC_ARCADE_BRAND_ACCENT` | `.STORY` | Accent wordmark segment |
| `NEXT_PUBLIC_ARCADE_TAGLINE` | `CARD ARCADE` | Small wordmark line |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Metadata base URL |
| `NEXT_PUBLIC_CARD_DATABASE_URL` | `/card-data/db.js` | Read-only card database script |
| `NEXT_PUBLIC_CARD_IMAGE_ROOT` | `/card-data/` | Root for relative card and set images |

See [INTEGRATION.md](INTEGRATION.md) for the database contract, reverse-proxy option, Docker/Portainer setup, and the short reintegration checklist.

## Docker

The Compose file forwards `.env` values as image build arguments:

```bash
cp .env.example .env
# edit .env, then:
docker compose up --build
```

Or build directly with the Dockerfile and the required `--build-arg` values. The server listens on `http://localhost:3000`.

## Project map

| Path | Purpose |
| --- | --- |
| `app/arcade-config.ts` | Neutral brand and card-data adapter |
| `app/page.tsx` | Main arcade state, catalog loading, and pack-opening flow |
| `app/gacha-engine.ts` | Deterministic pack recipes, rarity lanes, and collation |
| `app/use-gacha-audio.ts` | Safari-safe procedural music and immediate sound effects |
| `app/lucky-shrine.tsx` | Waifu 21 |
| `app/temptation-duel.tsx` | Heartlock |
| `app/heartlock-roster.ts` | Adult-only opponent pools by difficulty |
| `app/globals.css` | Responsive visual system |
| `public/pack-configs.json` | Booster metadata and published pull-rate source data |
| `public/card-data/` | Bundled read-only database, card scans, and set artwork |
| `tests/` | Pull logic, roster, audio, build, and rendered-output checks |

## Data boundary

The repository includes a dated, read-only card-library snapshot so development is self-contained. It does **not** include a tracker implementation, accounts, server credentials, private infrastructure details, or production deployment configuration. Optional build settings can point a deployment at another compatible snapshot without coupling feature work to that deployment.

## Collaboration

See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Keep all characters in mature artwork unmistakably adult, never commit credentials or private infrastructure details, and run `npm test` before pushing.

## Rights and disclaimer

This is an unofficial, non-commercial fan project and is not affiliated with Goddess Story, WaifuCards, or any represented franchise. Character names, likenesses, trademarks, and card artwork belong to their respective owners.

This private repository is shared for personal collaboration and is **not offered under an open-source license**. Do not redistribute or monetize third-party artwork without the necessary permission. See [NOTICE.md](NOTICE.md) for the asset boundary.
