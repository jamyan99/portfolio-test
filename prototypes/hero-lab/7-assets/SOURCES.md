# Phase 1 asset sources and rights

This is an isolated interaction prototype, not Jamiyan's final character or an approved likeness.

| Asset | Source | License / rights |
| --- | --- | --- |
| Rigged stand-in | [Xbot.glb, official three.js r186 example](https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/gltf/Xbot.glb); 67 original Mixamo bones, plus three local socket bones | The official example credits Mixamo. [Adobe's Mixamo usage FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) permits royalty-free personal/commercial project use. This model is **not CC0**, and the engine's MIT license is not its asset license. |
| Walk / Walk_Ball | Original embedded Xbot walk, retimed locally; carrying arms authored locally | Mixamo source terms as above; local edits in editable Blender source. |
| Other 14 skeletal clips | Authored locally for this prototype, baked onto the same Xbot skeleton in Blender | Local animation work; underlying character remains subject to Mixamo terms. |
| V5 moving layers (6 extra clips; 22 total) | Three upper-body variants of the locally authored basketball clips, plus three directional lower-body walk/shuffle variants, generated in `character/build_moving_layers.py` | Original local edits on the same licensed Xbot skeleton; the directional gaits derive from the embedded Mixamo walk. No game animations extracted. |
| V7 dribble lower layers (5 extra clips; 27 total) | Constant-pelvis dribble idle and four locomotion variants from `character/build_dribble_gaits.py`, preserving the existing foot paths with two-bone leg IK | Original local edits on the same licensed Xbot skeleton and embedded Mixamo walk. Retained source geometry/identity; no new third-party asset. |
| V8 run layers (10 extra clips; 37 total) | Genuine embedded `run` from the same original Xbot GLB; carrying, directional and stable-pelvis dribble-run layers authored in `character/build_run_layers.py` | Existing Mixamo source terms as above; original local retarget edits. No download, extraction from a game, generation or cost. |
| V3 low-handle body-mechanics reference | [CMU subject 6](https://mocap.cs.cmu.edu/search.php?subjectnumber=6), trials 06_13 / 06_14, inspected offline; CMU Graphics Lab Motion Capture Database, NSF EIA-0196217 | Free source references. V3 uses original authored tracks, not these raw captures. Original files, rights and isolated calibration studies are retained outside the website in `mocap-study/free-v3/`. No NBA 2K asset files are used. |
| Desk | Locally authored `props/build_studio.py` / `studio-source.blend` | Original project work; no third-party model license. |
| Laptop shell, hinge, keyboard, trackpad and screen | Same original Blender source | Original project work. Screen content remains the existing portfolio project artwork. |
| Chair | Same original Blender source | Original project work. |
| Desk lamp | Same original Blender source | Original project work; the scene's functional light/dark switch. |
| Hoop, backboard, rim and net | Same original Blender source; read-only supplied hoop image used as visual direction | Original project work. |
| Plant and pot | Same original Blender source | Original project work. |
| White studio room/court | Same original Blender source | Original project work. |
| V8 studio refinement | `props/polish_studio_v8.py`, derived from the original editable studio master | Original local material/geometry edits: continuous cove, flat court paint, white board frame, ivory base and plant polish. Critical prop positions retained. |
| V9 sunlit studio architecture and materials | `props/v9_environment.py`, combined by `props/build_studio_v9.py`; visual reference: the existing `assets/img/hero-poster.webp` | Original local geometry: actual arched rear-wall aperture, recessed plaster, charcoal mullion and sill. Original deterministic 128px concrete texture. No external asset download, API, generation or cost. |
| V9 furniture and hoop refinement | `props/v9_props.py`, editable `props/studio-v9/studio-v9-source.blend` | Original local rounded oak desk, joints, sketchbook, ergonomic chair details/casters, alpha-tinted board and clearer diamond net. Original deterministic 256px oak texture. Existing contact and collision-critical bounds preserved. |
| V10 connected workroom | `props/v10_room.py`, `props/build_studio_v10.py`; editable `props/studio-v10/studio-v10-source.blend` | Original room walls, squared doorway, oak lining and floor. Reuses V9's local oak image; no new texture, download, generation or cost. Runtime groups the ten authored parts into five meshes. |
| V9 basketball surface | `props/upgrade_ball_v9.py`, editable `props/ball-v9/basketball-v9-source.blend` | Original mathematical leather/channel albedo (512px) and micro-normal (256px). Existing mesh, UVs, radius and runtime connections preserved. No external downloads or cost. |
| Basketball mesh and leather/seam texture | Original Blender/Python geometry and mathematical texture in `props/build_studio.py` | Original project work. |
| Liminal laptop texture | Existing `assets/img/liminal/screens/meditation.jpg`, `community.jpg`, `onboarding-welcome.jpg` | Existing portfolio assets supplied for this use; originals preserved. Aspect-preserving local composition and KTX2 encoding. |
| ContentPlus laptop texture | Existing `assets/img/content-plus/screens/videos-home.jpg`, `coplay-game.jpg` and selected existing screen imagery; exact input hashes in the optimization inventory | Existing portfolio assets supplied for this use; originals preserved. |
| Vibe Coding laptop texture | Existing `assets/img/vibe-coding/screens/settings.png` | Existing portfolio asset supplied for this use; original preserved. |
| FINRA laptop texture | Only existing public cover `assets/img/framer/j90JLu2USyq46GRLYCzX1TgsCc-1024.webp` | Existing public portfolio cover; no NDA interiors loaded or reproduced. |
| Loading/fallback image/video | Existing `assets/img/hero-poster.webp`, `assets/video/hero-loop.mp4` | Existing approved portfolio media, referenced in place. |

Runtime tools: Three.js 0.186.1 (MIT), Rapier compat 0.19.3 (Apache-2.0), Meshoptimizer decoder (MIT), Basis Universal transcoder (Apache-2.0). CDN imports are pinned. Source art, authoring scripts, compression tooling, hashes and validation records are retained outside the website at `Portfolio/character-animation-production/realtime-phase1/`.

No paid assets, image/video generations, account sign-ins or credits were used for Phase 1. No external AI reconstruction service received the identity references.
