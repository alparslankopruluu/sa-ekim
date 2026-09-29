# Android expert tools and skills

*Read during `/factory-setup --android-tools` and before selecting external Android skills.*

The kit's Android contract is authoritative. External skills are focused, optional reviewers;
they never expand parity scope, approve dependencies, perform provider writes, or publish.

## Official baseline

- Official source: `android/skills` release `v1.0.7`, audited commit
  `1e5e7ae6138bebd0835d0d5854b0b9adfeed3181` (Apache-2.0).
- Install Android CLI only from the current official Android Developers download instructions,
  after showing version/source/telemetry behavior and receiving approval. Run `android info`,
  `android skills list --long`, and installed help before configuration.
- Install only: `android-cli`, `navigation-3`, `adaptive`, `styles`, `edge-to-edge`,
  `testing-setup`, `r8-analyzer`, `android-intent-security`, and `play-policy-insights`.
  Resolve the current CLI names from `android skills list`; stop if they do not map exactly.
  Never run `android skills add --all`.
- Keep external skills user-level for Claude/Codex where supported and record their source
  pin in the operator report; never vendor or silently update them in generated apps.

## Optional community lens

Only with `--android-community-tools`, audit license, HEAD, skill diff, install paths, and
overlap before installing the focused subset from `rcosteira79/android-skills` pinned at
`6373e59c1dcdb28fe94649e7db59055a5052f4db` (MIT): `android-dev`, `compose`,
`kotlin-coroutines`, `kotlin-flows`, `android-testing`, `android-debugging`, and
`android-gradle-logic`. If the pin drifted, stop for review.

Do not install the broad Drjacky or dpconde packages alongside this subset: their overlapping
architecture/dependency rules can conflict with the kit. Show trusted detected copies under
**Available extras**, but invoke them only when the user explicitly selects them.

The Android reverse-engineering skill is never part of an iOS-source port. It may be used
only for an Android artifact the user owns or is authorized to analyze, after recording that
authority and a lawful purpose. It is supplementary evidence only: never extract/copy a
third party's code, credentials, private API, signature scheme, assets, or trade dress.

## Tool doctor

Report `READY`, `PARTIAL`, or `BLOCKED` for Android Studio, stable SDK/target 36, platform and
build tools, JDK 17+, Gradle wrapper, ADB/emulator, bundletool, Android CLI, selected skills,
Fastlane Supply, and disk. Installation/login/license acceptance and every user-level config
diff require a preview. Never use `sudo`, curl-piped installers, shell-profile rewrites, or
secret input in chat.
