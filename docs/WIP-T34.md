# WIP T34 · Art, lighting, VFX and music pass

Done so far
- Camera: rig.groundAt is reset between scenes (the Meadow's hills used to lift the camera in the next scene); floor re-applied after push-in and shake; Hermon and the hub now give the rig their ground.
- One shared tier-up flourish (TypingFeedback.tierUp) called by every scene's hearTier; the HUD combo ring flares at a new tier (reduce-motion: glow only).

Next steps
- Screenshot tour of every scene (tests/tour, not committed), fix weak composition/lighting/readability.
- DONE: study theme (lessons, Practice), arcade theme (Game Room lobby, silent while an iframe game runs), modes runs play their setting region theme; tests in tests/unit/polish.test.ts.
- Unit tests, docs, progress.json checklist per scene, PR, merge.
