# Contributing

Thanks for helping improve the arcade.

## Workflow

1. Create a short branch from `main`, for example `feature/new-pack-flow`.
2. Keep a change focused enough to review in one pull request.
3. Run `npm test` and, for styling changes, check both desktop and mobile layouts.
4. Open a pull request explaining the player-facing change and how it was tested.

## Project rules

- Never commit passwords, tokens, cookies, private IP addresses, NAS paths, database dumps, or `.env` files.
- Do not weaken the pack-collation tests to make a distribution change pass. Explain the physical-pack evidence and update the tests with the recipe.
- Treat sound as part of the interaction: button and reveal audio should be scheduled in the same input frame.
- Keep keyboard and touch controls working alongside pointer interactions.
- Use only adult characters for suggestive artwork, and keep every depiction unmistakably adult.
- Add only artwork you generated or are allowed to use. Do not replace or redistribute bundled scans without the project owner's permission and a provenance review.
- Keep the bundled card snapshot and any configured replacement source read-only. The arcade must never modify an upstream tracker.

## Pull-rate changes

For a new or corrected set, record:

- cards per pack and packs per box;
- the ordered slot/lane structure;
- rarity upgrade probabilities;
- any guaranteed box hits;
- duplicate behavior inside a pack;
- the physical opening, manufacturer information, or other source used.

Prefer a small pure function plus a deterministic test over probability hidden in a component.
