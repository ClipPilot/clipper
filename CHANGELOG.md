# Changelog

## [1.2.2](https://github.com/ClipPilot/clipper/compare/v1.2.1...v1.2.2) (2026-03-28)


### Bug Fixes

* clean up error label in comfy controller ([#147](https://github.com/ClipPilot/clipper/issues/147)) ([0cbe432](https://github.com/ClipPilot/clipper/commit/0cbe432a61d3a669eab0fd21f0508d1add1d98e8))

## [1.2.1](https://github.com/ClipPilot/clipper/compare/v1.2.0...v1.2.1) (2026-03-28)


### Bug Fixes

* add workflow_dispatch trigger to release workflow ([c863709](https://github.com/ClipPilot/clipper/commit/c863709acfa81b2d84cf18a7f6fade22aad46be5))
* auto-tag pending release PRs when release-please skips ([3ce62c5](https://github.com/ClipPilot/clipper/commit/3ce62c529543f3a81af5f6d416931d046d8a9792))

## [1.2.0](https://github.com/ClipPilot/clipper/compare/v1.1.2...v1.2.0) (2026-03-28)


### Features

* consolidate CI/CD into unified pipeline ([ab6e7c8](https://github.com/ClipPilot/clipper/commit/ab6e7c83e64a0aa3cd27b703e80ef32b06eafa33))


### Bug Fixes

* only deploy changed services on tag push ([e5e3dcd](https://github.com/ClipPilot/clipper/commit/e5e3dcdaba61474faa4070b802bc378a87ae8e1c))
* remove unused sanitizeErrorForFrontend import in folder controller ([#143](https://github.com/ClipPilot/clipper/issues/143)) ([6f9da0a](https://github.com/ClipPilot/clipper/commit/6f9da0a3d6daf25718aee4b599f071e1a6643ab4))
* revert to GITHUB_TOKEN for release-please ([744a278](https://github.com/ClipPilot/clipper/commit/744a27871b9cbbaef22f610b57fa888e06e87299))
* standardize error label in comfy controller ([#144](https://github.com/ClipPilot/clipper/issues/144)) ([3a49f9e](https://github.com/ClipPilot/clipper/commit/3a49f9e755779f87fb44c1f6f22404f38cc7bbf9))
* trigger release on PR close to catch release PR merges ([eff5f2f](https://github.com/ClipPilot/clipper/commit/eff5f2fe88b3acf09fee5880860f94826f231a91))
* use GH_PAT for release-please PR creation ([4a00342](https://github.com/ClipPilot/clipper/commit/4a00342ffbe58e41325a5be1001c23c5d224a89f))
* use GH_PAT for releases and deploy all services on tag push ([075616b](https://github.com/ClipPilot/clipper/commit/075616be39fc2f984436193befb40fabdbe0981f))

## [1.1.2](https://github.com/ClipPilot/clipper/compare/v1.1.1...v1.1.2) (2026-03-28)


### Bug Fixes

* remove unused sanitizeErrorForFrontend import in folder controller ([#143](https://github.com/ClipPilot/clipper/issues/143)) ([6f9da0a](https://github.com/ClipPilot/clipper/commit/6f9da0a3d6daf25718aee4b599f071e1a6643ab4))
* use GH_PAT for releases and deploy all services on tag push ([075616b](https://github.com/ClipPilot/clipper/commit/075616be39fc2f984436193befb40fabdbe0981f))

## [1.1.1](https://github.com/ClipPilot/clipper/compare/v1.1.0...v1.1.1) (2026-03-28)


### Bug Fixes

* only deploy changed services on tag push ([e5e3dcd](https://github.com/ClipPilot/clipper/commit/e5e3dcdaba61474faa4070b802bc378a87ae8e1c))
* revert to GITHUB_TOKEN for release-please ([744a278](https://github.com/ClipPilot/clipper/commit/744a27871b9cbbaef22f610b57fa888e06e87299))

## [1.1.0](https://github.com/ClipPilot/clipper/compare/v1.0.0...v1.1.0) (2026-03-27)


### Features

* consolidate CI/CD into unified pipeline ([ab6e7c8](https://github.com/ClipPilot/clipper/commit/ab6e7c83e64a0aa3cd27b703e80ef32b06eafa33))


### Bug Fixes

* use GH_PAT for release-please PR creation ([4a00342](https://github.com/ClipPilot/clipper/commit/4a00342ffbe58e41325a5be1001c23c5d224a89f))
