---
gameSlug: steal-a-ninja-egg
clientDir: steal-a-ninja-egg-client
buildCommand: npm ci && npm run build
distDir: steal-a-ninja-egg-client/dist
serverDir: steal-a-ninja-egg-server
roomSize: 7
canDie: false
hasScore: true
leaderboards:
  - { id: cash_per_sec, label: Most Cash/s, order: desc, mode: best, format: compact, reset: none }
  - { id: top_speed, label: Top Speed, order: desc, mode: best, format: compact, reset: none }
  - { id: eggs_stolen, label: Eggs Stolen, order: desc, mode: sum, format: number, reset: weekly }
gameplayAds: false
adScreens: [lobby, gameplay]  # banners only while the game loads (lobby); none while playing
notApplicable:
  deathScreen: Nobody dies. A guardian catching an egg thief throws them back and the egg returns to its nest; they keep playing at once (no death, no respawn wait). The developer also wants no ads outside loading.
  rewardedAds: The game has no rewards earned by watching an ad (the developer wants ads only while loading).
---

# Boxity integration notes

- **Ads (developer's choice): only while the game loads.** `ads.declareScreens` lists `lobby` (the loading page and
  joining a server, also the reconnect page) and `gameplay` (`show: false`). The game reports `lobby` while
  loading and `gameplay` from the first frame of play, so no banners show while playing, popups included. It never
  asks for an ad break or a rewarded ad. Boxity's own ad breaks are still handled (`ads.onBreakStart` pauses the
  game and mutes it, `onBreakEnd` resumes).
- **Can die (canDie: false):** being caught = thrown back, the stolen egg returns to its nest. Boxity's "Reset
  Character" (`respawn_request`) sends the player back to their own pen at once.
- **Score (hasScore: true):** three boards, declared on the client with `leaderboard.define()` and submitted only by
  the server from its own state (`steal-a-ninja-egg-server/src/game/leaderboardReporter.js`).
- **Identity:** the profile card at the top right shows the signed-in player's Boxity picture and name; a guest
  gets the Bloxity base character's picture and a random name (Boxity's guest name, or one made once and kept in
  the browser). Next to it: the connection (signal bars + ping), the sound on/off (Boxity's master volume) and
  Gems. The game draws no Log in / Log out (Boxity's toolbar does). The server trusts only the verified token
  (`/v1/auth/game-token/verify`); guests get a server-made `guest_` id, and their progress moves into the account
  on first sign-in (`carriedFrom`).
- **Rooms:** one room = one lobby with 7 pens and the 10-stage track, `maxClients` 7. Joins go through the Boxity
  matchmaker (`Legion.SDK.net.resolveEndpoint`, a new Client per resolve, retries with backoff); `?roomId=` joins
  that room (its pod resolved first). Rooms are reported to "Open Rooms". No limit on players in the game: a full room
  makes the matchmaker open a new one (tested: 16 players -> rooms of 7, 7, 2) and Boxity adds pods (MAX_REPLICAS 20).
  Each player's own pets list and popup data go only to them (the 'mine' message), not through the shared room state.
- **Achievements (saved):** `profile.achievements` (server, `progress.updateAchievements`) keeps records that never
  go down: furthest stage reached, best Speed, best training arena, pen level, spin styles owned, best daily streak,
  guardian escapes, kunoichi hatched. Saved with the whole profile (Mongo / JSON), carried from a guest save on sign-in,
  and reported as Boxity profile stats with eggs stolen / hatched, pets hatched, rebirths, index pets and weapons
  (`statReporter.js`).
- **Gems:** `gems.requestPurchase(sku)` only; the webhook stores each grant by `transactionId` and answers 2xx.
- **Environments:** every Boxity URL comes from `src/bloxity/boxityEnv.js` (client) and `BLOXITY_*` env vars (server).
- **Deploy:** `.github/workflows/deploy.yml` (prod always, stage too with `LEGION_DEPLOY_TOKEN_STAGE`, manual
  `target` input), server image from `steal-a-ninja-egg-server/Dockerfile`.
