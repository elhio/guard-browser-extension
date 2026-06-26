# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Guard is a browser extension (Chrome/Edge/Brave + Firefox) that aims to detect deepfakes and block unsafe
visual media directly on the webpage in real time. The repo is currently a freshly scaffolded WXT + React
starter — the actual detection/filtering features are not yet implemented (`entrypoints/background.ts` and
`entrypoints/content.ts` are still the default "Hello" stubs).

License is AGPL-3.0; contributors must sign a CLA (enforced via `.github/workflows`).

## Commands

- `npm install` — install deps (also runs `wxt prepare` via `postinstall`)
- `npm run dev` — start dev server, loads the extension in a fresh Chrome profile
- `npm run dev:firefox` — same, for Firefox
- `npm run build` / `npm run build:firefox` — production build to `.output/<target>`
- `npm run zip` / `npm run zip:firefox` — package the built extension into a zip
- `npm run compile` — type-check only (`tsc --noEmit`), no test suite exists yet

There is no lint or test command configured yet.

## Architecture

Built on [WXT](https://wxt.dev/) (Next-gen Web Extension Framework) with the React module
(`@wxt-dev/module-react`). WXT auto-generates the `manifest.json` and provides the cross-browser `browser`
global from entrypoint files — config lives in `wxt.config.ts`.

- `entrypoints/background.ts` — the extension's background/service-worker script (`defineBackground`)
- `entrypoints/content.ts` — content script injected into matching pages (`defineContentScript`); the
  `matches` pattern controls which pages it runs on and will need to expand beyond the current
  `*://*.google.com/*` placeholder as real functionality is added
- `entrypoints/popup/` — the toolbar popup UI, a standalone React app (`main.tsx` mounts `App.tsx`)
- `public/` — static assets copied as-is into the build output (icons, etc.)
- `.wxt/` (generated, gitignored) — WXT's generated types/tsconfig; `tsconfig.json` extends it

Builds are per-browser-target (`chrome-mv3`, `firefox-mv2`, etc.) since manifest versions differ between
Chrome (MV3) and Firefox.
