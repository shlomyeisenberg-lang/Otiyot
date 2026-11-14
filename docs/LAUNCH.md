# Otiyot 1.0 — launch guide

## The website

`main` on Vercel is the live site. Version 1.0.0 is already what `main` serves once this release is merged; nothing else to do.

## Publish the plugin release (owner step)

1. On GitHub open the repository, Releases, "Draft a new release", choose "Create new tag" and type `v1.0.0` on `main`, then publish. (Or push the tag from a terminal: `git tag v1.0.0 && git push origin v1.0.0`.)
2. The `release` workflow (Actions tab) runs lint, typecheck, tests, builds the plugin, checks it and attaches `otiyot-1.0.0.otzplugin` to the release. If you used the web form, wait for the workflow and refresh the release page: the file appears under Assets.

## Install in Otzaria

1. Download `otiyot-1.0.0.otzplugin` from the release page.
2. In Otzaria open the plugins manager, choose to install a plugin from a file, and pick the downloaded file.
3. Open the new tool tab "אותיות". The game works offline; progress is saved inside Otzaria's plugin storage.

## Roll back

- Plugin: uninstall "אותיות" in the Otzaria plugins manager and install an earlier `.otzplugin` from the Releases page (each version tag keeps its file). Progress is stored by Otzaria, so it stays across a reinstall.
- Website: in Vercel, Deployments, pick the last good deployment, "Promote to Production". Or revert the merge on `main`.
- Release: if a bad release was published, delete the release and its tag on GitHub, fix on `main`, and tag the next patch version (for example `v1.0.1`).

## Check before tagging

`pnpm lint && pnpm typecheck && pnpm test && pnpm build:plugin` all pass (the last one also runs `scripts/check-plugin.mjs`, which opens the built archive the way Otzaria does: relative paths only, nothing fetched from the network).
