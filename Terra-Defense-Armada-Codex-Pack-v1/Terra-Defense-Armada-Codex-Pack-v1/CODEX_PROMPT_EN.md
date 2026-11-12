# Implement Terra Defense: Armada from this approved design package

You are implementing the user's project Terra Defense: Armada, officially localized in Russian as «Страж Терры: Армада»: a local, single-player, turn-based Battleship game with a space fleet theme. This package is the implementation brief. Carry the work through to a runnable browser prototype, following the milestones below.

The approved title pair is exact: Russian `Страж Терры: Армада`; English `Terra Defense: Armada`. Use `config/branding.json` for the menu, title screen, document title, credits, and other player-visible naming. Switch the displayed title with the UI language. Do not replace the Russian title with an English transliteration or literally translate the English title again. `Космический бой` / Space Battle is the former working title only. The original reference PNGs still contain that old heading; use their ship/HUD design, not their baked-in title, in the implementation. This branding update changes no gameplay rules.

## Read before editing

Read the repository's applicable AGENTS.md files and existing implementation. Then read these package files in order:

1. `docs/SPEC_RU.md` (authoritative behavior; Russian).
2. `docs/BRANDING_RU.md`, `docs/DECISIONS_RU.md`, and `docs/IMPLEMENTATION_PLAN_RU.md`.
3. `config/branding.json`, `config/game_rules.json`, `config/balance_draft.json`, `config/challenges.json`.
4. `docs/ACCEPTANCE_RU.md`, `docs/ART_BRIEF_RU.md`, and `assets/asset_manifest.json`.
5. The three approved images in `assets/references/`.

Preserve an existing working stack. For an empty repository, choose a small TypeScript browser stack and document the actual setup commands. Do not assume this archive already contains an application. Do not implement Terra Defense arcade mechanics: this is a separate turn-based project.

## Required release scope

Ship all three modes: Classic, Tactical, and all five Challenges. Local bots only: no server, rooms, accounts, or multiplayer system is required for the match engine. The human chooses a fleet faction; the bot receives the opposite faction. Faction differences are cosmetic.

- Board: 10 x 10, straight 1-cell-wide ships; standard fleet is four length-1, three length-2, two length-3, one length-4. No touching, including diagonals.
- Factions: Prototype / Twin / Bastion / Monolith versus Standard / Scorpion / Cascade / Hammer; use approved Russian UI labels Прототип / Близнец / Бастион / Монолит and Обычный / Скорпион / Каскад / Молот. Scorpion replaces the old name Storm/Шторм.
- Placement is select -> preview -> confirm. The chosen cell anchors the nose. Support rotate, move, remove, cancel, randomize, clear, and Ready. Preserve the original placement until an edit is confirmed. No drag interaction is required in the first version.
- A hit retains the actor's turn; a miss passes it. A turn means the entire uninterrupted sequence before control passes. At most one ability per such turn; hits do not refresh the quota.
- Resolve each accepted command atomically, then determine success, resource exhaustion, and the next actor. A win on the last available action/ammunition wins. Reject invalid commands without resource or turn changes.

## Abilities

Implement exactly four abilities in Tactical and Challenges:

| ID | Effect | Turn behavior |
| --- | --- | --- |
| pulse | Pick a 3x3 square; report the count of intact ship sections, not their coordinates. | Retain turn; normal shooting remains possible. |
| guidance | Reveal one random intact unknown enemy section, without damage. | End turn. |
| double_shot | Select two distinct legal targets before confirming; resolve both ordinary shots atomically. | Retain turn if either hits; pass if both miss. |
| repair | Confirm restoration of one damaged section on a surviving friendly ship. Never resurrect sunk ships. | End turn. |

Follow the explicitly labeled engineering defaults for edge clamping, snapshot scan history, duplicate guidance prevention, and repair visibility. Repaired cells can be attacked again. Broadcast ability use, but never the opponent's scan region/results or guidance coordinates. Classic has no ability panel or charge usage.

## Bots and information boundaries

Generate and persist a nickname, one of four hidden difficulties (easy/medium/hard/expert), and one of four hidden personalities (aggressive/scout/cautious/balanced). Profiles do not adapt during the match. Use the supplied 500-name dictionary unchanged and preserve its selection metadata. Avoid recent names and the human's name if one exists. Difficulty is independent of nickname.

The bot decision API must receive only its own fleet, its own observations/scans, public events, remaining known fleet information, and its private memory/RNG state. Do not pass the hidden human board or human private scans. Expert must be the strongest honest strategy. Give each personality its provisional starting inventory from config; bots never watch ads or refill during a match. Classic bots have no abilities.

## Economy: implement this exact eligibility state machine

Tactical charges belong to the global player profile, persist between matches, and have no design cap. Challenge inventories are isolated per attempt.

For a fresh profile, use the labeled default of zero charges and `freeStartEligible=true`. Only at the actual start of a new Tactical match (after valid placement + Ready), if eligible, grant exactly one random charge and set eligibility false. Loading, restarting the page, repeating Ready, and entering placement never grant again.

A natural Tactical victory or defeat restores eligibility; it does not also award another charge at completion. Surrender or replacing an already started Tactical match leaves eligibility false. The next Tactical match therefore starts without a grant; finishing that match naturally restores eligibility for the following one. Record unique operation/match IDs and persist updates transactionally.

Rewarded ads give the chosen ability: pulse +2, any other ability +1. Only the reward callback grants it. No reward on cancellation/error. Duplicate callbacks must be idempotent. Global inventory cannot be rolled back by replacing/loading a match slot.

## Challenges

Implement all five data-driven scenarios in `config/challenges.json`:

1. Last Stand: human fleet lengths 3,2,1 versus a full enemy fleet.
2. Flagship Hunt: sink the length-4 flagship within 35 player actions; one continuation +8 actions.
3. Ammunition Shortage: destroy the fleet with 45 ammunition; continuation +10 is provisional.
4. No Room for Error: destroy the fleet before 35 misses; continuation raises the limit to 45, provisionally.
5. Intellectual Superiority: defeat the strongest honest expert bot; provisionally choose six starting charges, max three of a single type.

Use the scenario inventories, limit accounting, and labeled bot defaults in config. Double shot costs one flagship action and two ammunition; each empty attacked cell is a miss; pulse costs no limited action, guidance and repair cost one flagship action and no ammunition. One rewarded refill/continuation maximum per attempt. The three resource-limited challenges offer continuation only at exhaustion. Never revive a destroyed human fleet. Store best completion rank without downgrading mastery on replay.

## UI and save behavior

Use the final compact HUD references, not earlier oversized buttons. Both boards stay visible: portrait has enemy above own; landscape has own left, enemy right. All cells and boards must actually be square. Keep board geometry exact even where concept images are approximate. Controls and confirmation do not overlay cells. Show enemy name, surviving ship counts, current actor, short events, and challenge limits.

Display shot results symmetrically: miss dots, hit crosses, gray crossed-out sunk models, automatic surrounding empty marks. Own ships are always visible; full enemy models appear only on sinking. Remove the cross on repair; briefly highlight the bot's last actual shot. Never show the bot's next target. Disable human target/ability input during the bot turn; pause remains available.

Main menu: Continue (most recently saved unfinished mode), New Game, Load Game, Settings. Load Game contains the three fixed mode slots. Exactly one save slot per mode; all five challenges share one attempt slot. No named save slots or arbitrary save list. Save/auto-save overwrites only that mode. Starting a new game in an occupied mode requires the specified replace confirmation.

Persist setup, match boards, knowledge, current turn/quota, bot identity/memory/RNG, inventories, challenge counters/refill status, and statistics. Keep profile inventory/eligibility/settings/results separate from mode snapshots. Commit profile + match mutations atomically. Autosave after accepted actions; do not rely only on page unload.

Results: shots, hits, misses, accuracy (shots only; a double shot is two shots), used abilities, and challenge result. Rematch preserves the bot's nickname/difficulty/personality but both sides place ships anew; bot charges reset, human persistent charges stay current. New Opponent generates a new profile. Challenges use Retry/Other Challenges. Settings: RU/EN, music/effect volumes, reduced animations.

## Assets

The final fleet sheet and two compact HUDs are references, not ready transparent sprites or executable UI. Follow `docs/ART_BRIEF_RU.md` to prepare eight production sprites while preserving approved designs. If image tooling is unavailable, use clearly recorded temporary representations for the first rules milestone; never report that production art is complete while it is still temporary. Do not use labels/grid/background from the sheet as part of a sprite. Keep gameplay hit/placement geometry cell-based.

## Yandex adapter

Keep the match engine independent of the SDK. Build a local test adapter with explicit success/cancel/error/unavailable cases and a separate test profile. Outside the platform, gameplay must still work; communicate ad unavailability clearly. The real adapter must load/init the current official SDK correctly, signal ready only when interactive, pause input/bots/audio for ads and platform pause, and restore the previous pause state. Only `onRewarded` issues a real reward; `onClose` does not. Re-check current official sources in `sources.json` before implementation. Do not import banner policies or ad schedules from another project.

## Implementation milestones and validation

1. Deliver a complete Classic match with placement, honest bot, outcome, and rematch.
2. Add the three fixed saves and settings, including setup restoration and replace confirmation.
3. Add all Tactical abilities, persistent charges, and exact free-start eligibility handling.
4. Add all five Challenges, isolated inventories, limits, completion ranks, and single continuations.
5. Integrate the platform adapter, production art, compact responsive HUD, localization, and browser checks.

Run meaningful rule/state tests and the acceptance scenarios. Prioritize bot information isolation, repair/re-shot legality, one ability per whole turn, atomic double shots, save/reward idempotency, challenge last-resource victory, and surrender eligibility. Verify Firefox plus mobile portrait and landscape. Use deterministic seeds in tests without giving bots access to placement RNG secrets.

Keep agreed rules fixed. Parameters marked `provisional_balance` or `engineering_assumption` are explicit starting values, not permission to silently rewrite mechanics. Record any necessary adjustment and its reason. Do not stop at a plan or a decorative screen: produce the runnable milestones.

At handoff, report actual run/build/check commands and their observed results, completed modes/features, remaining temporary assets or unresolved parameters, and where to open the playable build. Never claim an unrun test, measured balance, complete sprite set, SDK verification, or production deployment.
