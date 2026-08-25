# Integration guide

The shared repository is intentionally independent from any production domain. It runs out of the box with the bundled `public/card-data` snapshot. All optional deployment-specific connections pass through `app/arcade-config.ts` and the `NEXT_PUBLIC_*` build values listed in `.env.example`.

## Card database contract

`NEXT_PUBLIC_CARD_DATABASE_URL` points to a JavaScript file that assigns a database to `window.CARD_LISTER_DB`:

```js
window.CARD_LISTER_DB = {
  cards: [
    {
      id: 1,
      number: "SSR-001",
      rarity: "SSR",
      ord: 1,
      set_name: "EXAMPLE-01",
      character: "Example Character",
      title: "Example Series",
      image_path: "images/cards/EXAMPLE-01/SSR-001.webp"
    }
  ],
  sets: [
    {
      name: "EXAMPLE-01",
      group: "1 yuan",
      images: ["images/sets/EXAMPLE-01.webp"]
    }
  ]
};
```

`NEXT_PUBLIC_CARD_IMAGE_ROOT` is prepended to relative `image_path` and set-cover values. Absolute `http`, `https`, and `data` image paths pass through unchanged.

The card source is read-only. Do not give the arcade database write credentials or access to tracker administration APIs.

## Recommended deployment boundary

The neutral defaults use same-origin bundled files:

- database script: `/card-data/db.js`
- image root: `/card-data/`

No proxy is required for local development. A production deployment may map those paths to another permitted card-data service or provide absolute HTTPS URLs through private deployment settings. This keeps infrastructure names out of application code and makes later reintegration a configuration-only change.

## Local integration

```bash
cp .env.example .env.local
```

The copied file is optional. Edit it only to override the bundled database/image root, then run `npm run dev`. `.env.local` is ignored and must never be committed.

## Docker or Portainer integration

The Dockerfile exposes the same values as build arguments. Put them in the deployment environment or in an untracked Compose `.env` file, then build the image:

```bash
docker compose build --no-cache
docker compose up -d
```

These are public client-side settings, not secrets. Passwords, tokens, internal network addresses, and administrative endpoints do not belong in any `NEXT_PUBLIC_*` value.

## Bringing upstream changes into a deployment

1. Merge or pull the latest `main` branch.
2. Keep the deployment's private `.env`/Portainer build values unchanged.
3. Run `npm test`.
4. Rebuild the container.
5. Verify the bundled or configured card database loads and that card image paths resolve.

Because branding and data endpoints live behind the adapter, feature work should merge without edits to the game engine, components, or styles.
