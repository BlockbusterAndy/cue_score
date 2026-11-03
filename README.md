# Cue Score

Snooker scoreboard for a phone held in one hand at the table. Works offline, installable as a PWA.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # rules-engine unit tests (Vitest)
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ (the service worker only runs in a build)
```

## Deploy to Cloudflare Pages

Dashboard: build command `npm run build`, output directory `dist`.
CLI: `npm run deploy` (runs `wrangler pages deploy dist --project-name cue-score`; needs `npx wrangler login` once).

`public/_headers` stops the service worker from being cached by the CDN, so updates reach phones.

## Layout

```
src/engine/            Pure rules engine. No React, no DOM.
  types.ts             Shared types + the RulesModule interface
  common.ts            Turn order, breaks, fouls, logging shared by all modes
  modes/snooker.ts     Standard (15 reds) and Short (10/6 reds)
  modes/points.ts      Points Snooker house rules (default)
  modes/killer.ts      Killer, 3–10 players
  modes/free.ts        Free scoring, custom balls
  match.ts             Frames, best-of-N, replay
  __tests__/           Vitest suites
src/hooks/useMatch.ts  useReducer over the engine; undo = replay all actions but the last
src/store/             IndexedDB key-value store (localStorage fallback), players, presets, matches
src/screens/           Home, NewMatch, Scoreboard, Summary, Stats, Rules
src/ui/kit.tsx         Ball, buttons, bottom sheet, stepper, segmented control
```

Every mode implements:

```ts
init(config, frameIndex?) → FrameState
apply(state, action) → FrameState   // returns the same object if the action is illegal
getLegalBalls(state)
getStatus(state)                    // ball on, points left, lead, snookers needed
isFrameOver(state)
```

A match is saved as its config plus the list of actions, so undo is unlimited and a match survives a refresh or the phone locking.
