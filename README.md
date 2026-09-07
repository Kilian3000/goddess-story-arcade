# Goddess Story Arcade

[![CI](https://github.com/Kilian3000/goddess-story-arcade/actions/workflows/ci.yml/badge.svg)](https://github.com/Kilian3000/goddess-story-arcade/actions/workflows/ci.yml)

A fan-made browser arcade for Goddess Story boosters.

This started with a simple problem: opening digital packs felt flat. Browse a ring of boosters, pick the one that feels lucky, rip the wrapper, and work through the cards. There are also two games for winning more packs.

Everything needed to run it is in this repository, including the card catalog and artwork. No account, API key, tracker, or separate image server is required.

> **18+ project:** some cards and character artwork are suggestive or NSFW.

![Choose a booster from the rotating pack carousel](docs/showcase/pack-carousel.png)

## New in 0.2

The pack carousel is purely for fun: all twelve positions have the same odds. Swipe to spin it, tap a side pack to bring it forward, then pick one up to open. You can change your mind before ripping.

On phones, a slow drag tilts the stack and exposes the opposite edges. A quick flick in any direction reveals the next card—never the previous one. Tap the card for details.

<p align="center">
  <img src="docs/showcase/carousel-phone.png" width="38%" alt="Phone booster carousel">
  <img src="docs/showcase/reveal-phone.png" width="38%" alt="Phone card reveal with directional peek controls">
</p>

## What is in here?

- **Open Packs:** 47 booster configurations across the 1, 2, 5, 10, and 20 yuan lines.
- **Pick your pack:** a looping, swipeable booster carousel with momentum and snap-to-pack selection. No odds tricks.
- **Pack collation that makes sense:** cards are drawn from ordered rarity slots instead of one flat random pool. Exact duplicate cards are blocked inside a single pack.
- **Proper pack-opening feedback:** ripping, card swipes, rarity effects, keyboard/touch controls, sound effects, and procedural music.
- **Waifu 21:** blackjack against a rotating dealer. Better hands win better packs.
- **Heartlock:** a timing game with different opponents and difficulty levels.
- **Local saves:** opened-pack counts and game progress stay in the browser.

<p align="center">
  <img src="docs/showcase/heartlock.jpg" width="49%" alt="Heartlock timing game">
  <img src="docs/showcase/waifu-21.jpg" width="49%" alt="Waifu 21 blackjack game">
</p>

## Run it locally

You need Node.js 22.13 or newer.

```bash
git clone https://github.com/Kilian3000/goddess-story-arcade.git
cd goddess-story-arcade
npm ci
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # lint source and tests
npm test         # game logic, assets, audio contracts, build, and rendering
```

## Docker

```bash
docker compose up --build
```

The app will be available on port `3000`. The included Compose file is intentionally generic, so it can be dropped into Portainer or another deployment without carrying private server details with it.

## Card data

The repository includes a read-only snapshot with 7,013 card records and the matching card/set images under `public/card-data`.

The default paths are:

- `/card-data/db.js`
- `/card-data/images/...`

If a deployment needs a different catalog or image source later, copy `.env.example` and set the `NEXT_PUBLIC_CARD_*` values. The game code does not need to be changed. The expected database shape and reintegration steps are in [INTEGRATION.md](INTEGRATION.md).

## Where things live

- `app/page.tsx` — main arcade and pack-opening flow
- `app/pack-carousel.tsx` — pre-opening booster selection
- `app/pack-stack.tsx` — card movement and directional peeking
- `app/gacha-engine.ts` — pack recipes and rarity collation
- `app/use-gacha-audio.ts` — music and sound effects
- `app/lucky-shrine.tsx` — Waifu 21
- `app/temptation-duel.tsx` — Heartlock
- `app/arcade-config.ts` — branding and card-data adapter
- `public/pack-configs.json` — booster configurations
- `public/card-data` — bundled catalog and artwork
- `tests` — pull logic, roster, audio, asset, and rendering checks

## Contributing

Pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md), keep suggestive character art unmistakably adult, and run `npm test` before pushing.

## Disclaimer

This is an unofficial, non-commercial fan project. It is not affiliated with Goddess Story, WaifuCards, or any represented franchise. Character names, likenesses, trademarks, and card artwork belong to their respective owners. See [NOTICE.md](NOTICE.md) for the asset and data notes.
