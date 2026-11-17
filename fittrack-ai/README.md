# FitTrack AI

Personal fat-loss tracker, nutrition logger, workout guide and coach for Android and iOS.
React Native (Expo SDK 58, development builds), TypeScript strict, Expo Router, Supabase,
TanStack Query, Zustand.

**Status: phases 1 (Foundation), 2 (Core tracking) and 3 (AI) of 7 are built.** Phases 4 to 7
are not started; the Train and Progress tabs say so in the app rather than showing placeholder data.

## What is built

| Area | Where |
|---|---|
| Design system: "night court" palette (ink, volt lime, amber, sky blue) in light and dark, Barlow Condensed and Inter, motion helpers, floating tab bar | `src/ui/` |
| Navigation: auth, onboarding, five tabs, edit-profile modal | `src/app/` |
| Email and password auth, session kept on the device | `src/auth/` |
| Onboarding pre-filled from the brief, all values editable later | `src/features/setup/` |
| Offline-first storage and sync queue | `src/data/` |
| Pure logic: Asia/Kolkata dates, programme, validation, burn estimate, deficit verdict, day score, macro check, meal totals, quick adds, food list | `src/domain/` |
| Today tab: week strip with score rings, hero rings and verdict, four meal slots, water tank, steps, toggles, chai sugar, weight, waist, note, history by day | `src/features/today/`, `src/app/(tabs)/index.tsx` |
| Animated rings and water tank (SVG + Reanimated) | `src/ui/Rings.tsx`, `src/ui/WaterTank.tsx` |
| Edge Functions `estimate-meal`, `coach-chat`, `generate-report` | `supabase/functions/` |
| Provider-agnostic AI layer (Gemini adapter, test provider), estimate validation, coach guardrails, report numbers | `supabase/functions/_shared/` |
| Photo capture, offline estimate queue, scanning animation, item breakdown, confidence labels | `src/ai/`, `src/features/today/EntryCard.tsx` |
| Coach tab: chat and daily and weekly reports | `src/features/coach/`, `src/app/(tabs)/coach.tsx` |
| Postgres schema (22 tables), row-level security, partner-link functions, private photo buckets | `supabase/migrations/` |
| Database tests: user isolation, partner sharing, unlinking | `supabase/tests/` |

### How offline-first works

Every write goes to the on-device SQLite database and an outbox in one transaction; the
UI reads only from the device. A sync worker sends the outbox in order when a connection
is available (on save, on returning to the app, when the network comes back, and every
30 seconds while anything is waiting). Conflicts are last-write-wins per row on
`updated_at`, enforced by a database trigger. A change the server rejects is parked and
shown in the app, never dropped.

### How the AI parts work

- **Shared code.** Burn, verdict, day score, meal totals and dates live in
  `supabase/functions/_shared/domain/` and are re-exported by `src/domain/`, so the app and the
  Edge Functions run exactly the same tested code.
- **Logging a meal.** A photo, a line of text, or both. The meal is saved on the phone first with
  empty numbers and marked "pending"; the photo is copied into app storage. When there is a
  connection the queue uploads the photo to the private `meal-photos` bucket under your own
  folder, calls `estimate-meal`, and fills in the numbers. With no signal the editor opens so
  you can type numbers if you want; the estimate still runs later. A meal is never lost.
- **Your numbers win.** The original AI estimate is stored unchanged in `ai_estimate`. Typed
  numbers are never overwritten, even by an estimate that arrives later, and the entry shows
  "Your numbers". "Use these" in the editor restores the AI numbers.
- **Validation.** Every model answer is checked on the server (types; kcal 0 to 5,000; protein
  0 to 300; other ranges) and retried once before anything reaches the app. Totals are
  recomputed from the item breakdown so they always add up.
- **Coach.** The function loads 35 days of your own data as you (row-level security applies to
  every query), labels each value as estimated, measured or not logged, and passes it to the
  model with the brief's rules. After the model answers, code checks the reply: a suggested
  intake under 1,400 kcal, rapid-loss tactics, or symptoms without a doctor mention each add a
  fixed safety note. The exchange is stored in `coach_messages`.
- **Reports.** All numbers are computed in code, on the phone (so they show offline) and again in
  the function. The model only writes the headline, what went well, what to improve, next steps
  and a weight-trend sentence, from those facts. Reports are stored in `ai_reports` and shown
  as stored; "Rewrite" regenerates on request.

### Decisions made in phase 3

- **No food means nothing added.** If the model finds no food, the placeholder entry is removed
  and a notice says so. If you had already typed numbers into it, it is kept and marked failed.
- **The item breakdown is stored in `ai_estimate.items`**, not as `meal_items` rows. The table
  exists and is covered by row-level security, but nothing writes to it yet.
- **Weekly report = the last 7 complete days** (ending yesterday). Daily covers today or
  yesterday.
- **Limits:** 60 coach questions per 24 hours per user; descriptions up to 1,000 characters;
  photos are resized to 1,024 px on the phone before upload.
- **Retries:** a failed estimate is retried on each sync, up to 4 times, then shown as "Could
  not estimate" with a Retry button.
- Generating the daily report automatically at the evening reminder needs notifications
  (phase 6); for now reports are generated on request.

### Decisions made in phase 2

- **Macro check threshold is 5 percent, not 10.** The brief's rule says 10 percent, but its own
  fixture (1,663.2 kcal logged against 1,548.5 from macros) is a 6.9 percent gap and must show
  a note. One constant, `MACRO_GAP_THRESHOLD` in `src/domain/meals.ts`, controls it.
- **Rings and the water tank are drawn with react-native-svg and Reanimated, not Skia.** Same
  visuals and animation, and it can be exercised in a browser here. Skia can replace them later.
- Meal logging in this phase is manual: one tap from the bundled food list, quick adds,
  favourites, same-as-yesterday, or your own numbers. Photo and AI estimates are phase 3.
- Steps are typed in for now; Health Connect and HealthKit sync is phase 6.
- The 51-item food list is bundled in the app (so it works offline) and seeded into
  `food_items`. Extending it is done by saving favourites; a food-list editor is not built.

### Decisions made in phase 1

- The brief's colour tokens were replaced at the owner's request. All colours live in
  `src/ui/theme.ts`; motion (entrances, count-ups, sliding tab highlight, press springs) uses
  Reanimated and follows the system reduce-motion setting.
- The programme starts on **Tuesday** 17 November 2026 (the brief said Monday). Programme
  weeks are 7-day blocks from the start date; the week strip (phase 2) uses Monday to Sunday.
- A couples session with a linked partner is stored as **one row per account**, joined by
  `couple_group_id`. After unlinking, each person keeps their own copy and loses access to
  the other's. While linked, either partner's phone can write couples-session rows into the
  other's account; that is how one phone records the session for both.
- A person can have one linked partner at a time.

## Setup

Requirements: Node 20 or newer. For device builds: Android Studio, or Xcode on a Mac.

```bash
cd fittrack-ai
npm install
cp .env.example .env.local      # then fill in the two EXPO_PUBLIC_ values
```

### Supabase

1. Create a project at supabase.com (the free tier is enough).
2. Install the Supabase CLI, then from `fittrack-ai/`:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push              # applies supabase/migrations
   ```
3. Put the project URL and the **anon** key in `.env.local`. The service-role key is never
   used by the app.
4. Optional: in Authentication settings, turn off "Confirm email" while you are the only user.

### Environment variables

See `.env.example`. The app needs only `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY`. The AI variables are Edge Function secrets and never ship in
the app.

### Edge Functions

```bash
supabase secrets set AI_PROVIDER=gemini AI_MODEL=<vision-capable model id> GEMINI_API_KEY=<key>
supabase functions deploy estimate-meal coach-chat generate-report
```

The functions require a signed-in user's token (Supabase's default JWT check stays on) and run
every query as that user. To switch provider or model later, change the secrets; no code change
or app release is needed. Adding another provider is one adapter in
`supabase/functions/_shared/ai/provider.ts`.

## Running

The app uses native modules (SQLite now; Skia, health data and notifications later), so it
needs a development build, not Expo Go.

```bash
npx expo run:android            # builds and installs on a connected phone or emulator
npx expo run:ios                # macOS with Xcode only
npx expo start                  # afterwards, to start the dev server for that build
```

Cloud builds with EAS (APK, AAB, iOS) are set up in phase 7.

## Tests

```bash
npm test             # unit tests: domain logic, AI validation, Gemini adapter, guardrails, reports, estimate queue, store, sync
npm run test:db      # database tests: RLS, partner sharing, and the three function handlers run as the user
npm run check:functions   # type-checks the Edge Functions with Deno (needs deno installed)
npm run typecheck
npm run lint
```

`npm run test:db` starts a throwaway Postgres, applies a small stand-in for Supabase's
`auth` and `storage` schemas (`supabase/tests/supabase_shim.sql`), applies every migration,
and runs the tests as the `authenticated` role with a user id in the JWT claims, which is
how Supabase evaluates policies. To run them against a real local Supabase instead:

```bash
supabase start
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db
```

## Not verified yet

Phases 1 to 3 were built in a cloud container with no phone, emulator or Supabase project.

- **Nothing has run on Android or iOS.** The screens were exercised as a web build in a
  headless browser against a mock backend (screenshots in `docs/phase1/` to `docs/phase3/`).
- **Real AI calls.** Estimation, coach and reports ran against a fake provider and a mock
  backend. The Gemini adapter is tested against a stubbed HTTP layer only: real model output,
  photo recognition quality and latency are unverified until a key is set.
- **Edge Functions in the Supabase runtime.** The handlers are tested against Postgres with the
  real schema and policies, and the entry points pass `deno check`, but the functions have not
  been deployed or served. `_shared/deno/supabaseDb.ts` (the supabase-js data access) and the
  Storage download are type-checked only.
- **Camera and photo library on a phone**, permission prompts, and on-device image resizing.
- **Real Supabase.** Migrations and policies were tested on plain Postgres 16 with the
  stand-in above, not on a Supabase project. Storage policies were tested against a
  stand-in `storage.objects` table, not Supabase Storage. Sign-up, sign-in and the email
  confirmation flow have not run against Supabase Auth.
- **On-device SQLite.** The store's SQL is unit-tested with Node's SQLite; the expo-sqlite
  adapter and the session key-value store have only been type-checked.
- **Animation on a phone.** Ring draw-in, the water wave, count-ups and springs have only run
  in a desktop browser; frame rate on a mid-range Android phone is unmeasured.
- **Device behaviour.** Haptics, font loading, safe areas, the keyboard, network-change detection and
  background and foreground sync on a phone.
