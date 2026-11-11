# Shooter: play page + desktop app

**Play page:** https://willcoding11.github.io/shooter-play/ (current game link, online status, app downloads).

- `link.json` is updated automatically by the host's `start.bat` every time the game starts.
- `desktop/` is the app (Electron). It finds the current game from `link.json`, follows the host to a new link,
  and the game reloads itself when the host updates it.
- Pushing a tag `v*` builds Windows / macOS / Linux apps with GitHub Actions and attaches them to a release;
  the play page always links the newest one.

This repo is generated from the game project (`site/` + `desktop/`) by `scripts/publish-pages.js`; edit it there.
