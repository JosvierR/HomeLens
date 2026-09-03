# Contributing

HomeLens is intentionally small and product-focused.

## Development

```bash
npm install
npm run dev
```

Before opening a PR:

```bash
npm run test
npm run typecheck
npm run build
```

## Engineering rules

- Keep uncertainty and provenance explicit in the domain model.
- Do not label heuristics as certified HVAC calculations.
- Prefer pure functions for decision logic so behavior is testable.
- Instrument important product transitions before shipping them.
- Keep native capture concerns separate from decision and review logic.
