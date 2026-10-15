# SafeTrack redesign plan (approved 2026-10-15)

Branch `redesign` in both repos, created from tag `before-redesign`. Visual
layer only: no changes to services, stores, RPCs, routes, navigation targets,
watch internals, or SOS timing (phone countdown 5 s, watch 3 s). Commit after
each stage; never push or merge without the user's OK.

## Decisions
- **Concept: "calm cartography".**
  - Warm paper surfaces, ink-thin 1-px rules instead of drop shadows, small
    uppercase "map legend" labels above calm large values.
  - A fine contour-line motif, at most once per screen (Home header, empty
    states, onboarding).
  - Signature: the child photo/initials ring whose colour shows the state
    (inside / outside / offline / SOS) and matches the map marker.
  - Red only for SOS/danger.
- **Fonts: option A.** Fraunces (headings only, via `expo-font` +
  `@expo-google-fonts/fraunces`) with the system font for everything else.
  Bundle the font in `res/font` on the watch.
- **Appearance:** light by default, plus a full dark theme.
  - User setting **Light / Dark / Match phone**, saved locally (AsyncStorage,
    in try/catch), in Profile.
  - The admin dashboard follows the same setting.
  - The watch is always true black.
- **Dependencies:** no new animation library; use RN `Animated` and Compose
  animations. Fonts are the only new packages.
- **Out of scope:** the unreachable routes `activity-map`, `reports`,
  `manage-access`, `(app)/child-profile` and `splash-screen` are left as is.

## Tokens
Light:
| Token | Hex | Contrast on paper |
|---|---|---|
| paper | #F5F2EA | |
| surface | #FFFDF8 | |
| sunken | #ECE7DC | |
| rule | #DED7C9 | |
| ink | #1B2420 | 14.2 |
| ink2 | #46504A | 7.5 |
| muted | #666F69 | 4.6 |
| primary | #1E5C45 | 7.0; white on it 7.9 |
| primaryTint | #E1ECE4 | primary on it 6.5 |
| danger | #B4301F | 5.6; white on it 6.2 |
| dangerTint | #F8E3DD | danger on it 5.0 |
| warning (text) | #8A5A00 | 5.3 |
| warningFill | #F0B23C | ink on it 8.4 |
| safe | #2B7A4B | 4.7 |
| info | #245E9C | 6.0 |
| offline | #636963 | 5.0 |

Dark:
| Token | Hex | Contrast |
|---|---|---|
| paper | #111513 | |
| surface | #181D1A | |
| sunken | #0C0F0D | |
| rule | #2A322D | |
| ink | #EDEFE9 | 15.9 |
| ink2 | #BCC3BC | 10.2 |
| muted | #8E968F | 6.1 |
| primary | #7CC79F | 9.2; dark paper on it 9.2 |
| danger | #FF7A6B | 7.2 |
| warning | #F2B94B | 10.4 |
| safe | #6ACB93 | 9.3 |
| info | #7DB2EA | 8.3 |
| offline | #9AA19B | 7.0 |

Watch:
| Token | Hex | Contrast |
|---|---|---|
| black | #000000 | |
| surface | #121614 | |
| ink | #F2F4EF | 19.0 |
| muted | #A3ABA4 | 8.9 |
| primary | #7CC79F | 10.5 |
| sos | #FF6B5C | 7.5; black on it 7.5 |
| warning | #F2B94B | 11.8 |
| safe | #6ACB93 | 10.6 |

## Type, space and shape
- **Type:**

  | Style | Size / line height | Font |
  |---|---|---|
  | Display | 34/40 | Fraunces |
  | Title | 26/32 | Fraunces |
  | Heading | 19/26 | Fraunces |
  | Body | 15/22 | system |
  | Label | 13/18 | system |
  | Legend | 11/14, uppercase, +0.8 tracking | system |

  Tabular numbers for times, distances, counts and battery.
- **Spacing:** 4, 8, 12, 16, 24, 32, 48. Minimum phone gutter 16.
- **Radii:** 8 (inputs, chips), 14 (sheets, map), full (pills and rings).
- **Elevation:** only for floating elements (map controls, sheets, SOS band).

## Motion
- **Press:** scale 0.98 + dim, 120 ms.
- **First-load entrance:** fade + 8 px rise, 200 ms, 40 ms stagger, first load
  only.
- **Sheets:** in 280 ms ease-out, out 200 ms ease-in.
- **Segment indicator:** 220 ms.
- **Stat count-up:** 400 ms, once.
- **Pulse:** only on the live-location dot and active SOS.
- **Success:** a check draws in, 300 ms.
- **SOS hold ring:** fills exactly in time with the real hold duration.
- **Reduce Motion:** everything becomes instant or a plain fade
  (`AccessibilityInfo.isReduceMotionEnabled`; the Wear OS system setting).

## Onboarding
- Skip always visible; Back/Next with dots.
- Illustrations drawn in code.
- Completion stored per device and audience. On storage failure it shows once;
  it never crashes.
- Permission pages hand off to the **existing** request code.
- **Guardian** (after the first successful login):
  1. Know where they are (pin).
  2. Draw a safe place (zone circle).
  3. SOS reaches you first (pulsing ring; repeats until acknowledged).
  4. Their day, retraced (route line; AI notices are advisory).
  5. Setup: notifications primer (existing push registration), then Register
     your child or Go to Home.
  - Replay: Help & support.
- **Child phone** (after linking):
  1. Your guardian can see where you are when you share.
  2. Hold SOS, then a countdown you can cancel.
  3. Share location + optional auto-share.
  4. All set.
  - Replay: child profile.
- **Watch** (after the first pairing; round, swipe paging):
  1. Hold until the ring fills, or shake.
  2. Cancel during the 3-second countdown.
  3. Keep charged and connected.
  4. "All the time" location survives restarts, then the existing permission
     screens.
  - Replay: Status screen.
- **Admin:** no tutorial; one dismissible tips banner on the dashboard.

## Key screens
- **Guardian Home:**
  - A contour header with the child ring, name and legend line
    ("INSIDE · HOME · 2 MIN AGO").
  - The map card.
  - A three-up stat strip (SOS / Zones / AI) divided by rules.
  - A "Today" line (distance · span · stops) linking to Activity.
  - An active SOS becomes a full-width red band at the top with location and
    Acknowledge.
- **Child phone SOS:** a big hold ring ("HOLD SOS") with
  "Keep holding. Lift to stop."; the countdown shows a huge numeral, a red
  ring and Cancel SOS.
- **Watch SOS:** curved time and battery, a central ring that fills during the
  hold, a safe-zone line underneath; the countdown is a black screen, a giant
  numeral and CANCEL.

## Stages (one commit each, on `redesign`)
1. Tokens and primitives: one design system replacing `guardianDesign`,
   `safeTrackDesign`, `adminDesign`, `childDesign` and `theme`; ThemeProvider
   with Light/Dark/Match phone; Fraunces.
2. Auth.
3. Onboarding (guardian, child phone, watch, admin banner).
4. Guardian screens.
5. Maps and History (marker/controls/sheet restyle only).
6. SOS and notifications.
7. Child phone.
8. Admin web.
9. Wear OS (theme mirrors the tokens).

After every stage:
- `npx tsc --noEmit -p .`
- web/Android/iOS exports
- `gradlew.bat assembleDebug testDebugUnitTest` for the watch
- before/after browser screenshots (phone and desktop width)
- confirm every button still does the same thing

Never claim device behaviour that was not run on a device.
