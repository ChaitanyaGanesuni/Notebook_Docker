# FitTrack AI

Personal fat-loss tracker, nutrition logger, workout guide and coach for Android and iOS.
React Native (Expo SDK 58, development builds), TypeScript strict, Expo Router, Supabase,
TanStack Query, Zustand.

**Status: phase 1 of 7 (Foundation) is built.** Phases 2 to 7 are not started; the Train,
Progress and Coach tabs say so in the app rather than showing placeholder data.

## What phase 1 contains

| Area | Where |
|---|---|
| Design system: "night court" palette (ink, volt lime, amber, sky blue) in light and dark, Barlow Condensed and Inter, motion helpers, floating tab bar | `src/ui/` |
| Navigation: auth, onboarding, five tabs, edit-profile modal | `src/app/` |
| Email and password auth, session kept on the device | `src/auth/` |
| Onboarding pre-filled from the brief, all values editable later | `src/features/setup/` |
| Offline-first storage and sync queue | `src/data/` |
| Pure logic: Asia/Kolkata dates, programme week and day, validation | `src/domain/` |
| Postgres schema (22 tables), row-level security, partner-link functions, private photo buckets | `supabase/migrations/` |
| Database tests: user isolation, partner sharing, unlinking | `supabase/tests/` |

### How offline-first works

Every write goes to the on-device SQLite database and an outbox in one transaction; the
UI reads only from the device. A sync worker sends the outbox in order when a connection
is available (on save, on returning to the app, when the network comes back, and every
30 seconds while anything is waiting). Conflicts are last-write-wins per row on
`updated_at`, enforced by a database trigger. A change the server rejects is parked and
shown in the app, never dropped.

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

See `.env.example`. Only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are
needed in phase 1. The AI variables are Edge Function secrets and are used from phase 3.

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
npm test             # unit tests: dates, programme, validation, form, local store, sync queue
npm run test:db      # database tests: needs Postgres installed locally (or TEST_DATABASE_URL)
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

Phase 1 was built in a cloud container with no phone, emulator or Supabase project.

- **Nothing has run on Android or iOS.** The screens were exercised as a web build in a
  headless browser against a mock backend (screenshots in `docs/phase1/`).
- **Real Supabase.** Migrations and policies were tested on plain Postgres 16 with the
  stand-in above, not on a Supabase project. Storage policies were tested against a
  stand-in `storage.objects` table, not Supabase Storage. Sign-up, sign-in and the email
  confirmation flow have not run against Supabase Auth.
- **On-device SQLite.** The store's SQL is unit-tested with Node's SQLite; the expo-sqlite
  adapter and the session key-value store have only been type-checked.
- **Device behaviour.** Font loading, safe areas, the keyboard, network-change detection and
  background and foreground sync on a phone.
