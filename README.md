# 💘 DATE ME

**Real dates. No chats.** — a stylish, installable dating **PWA**.

Dating apps trap you in a loop: swipe, match, pay, text into the void. **DATE ME** flips it:

- 🚫 **No swipe system, no correspondence** — you decide with two buttons: ☑️ like / ❎ next
- 👀 **See who liked you — always FREE**
- 🟢 **Online-only**: you only see (and can only interact with) people who are online right now, within a **10 km** radius
- 🪪 **No bios or life stories** — only a real name, age, languages and verified real photos. That's what the date is for.
- 💸 **No subscriptions, no paywalls** — one-time purchase, every feature included

## The 4 sections

| # | Section | What happens |
|---|---------|--------------|
| 1 | **I like her/him** | Everyone online nearby. ☑️ Like or ❎ next — your decision |
| 2 | **She/he liked me** | Everyone who liked you, free to see. ☑️ Like back or ❎ not today |
| 3 | **Meet — when & where?** | After a mutual like, plan the date in **5 questions, without any chat**: who picks the spot → outside or inside → where exactly → which day → what time. If you both want to pick (or both don't), the app decides randomly 🪙 |
| 4 | **My dates** | The confirmed list: person, place, date, time — plus past/inactive ones |

## Demo mode

This repository is the **frontend prototype**: there is no backend yet, so the
people nearby, incoming likes and the partner's yes/no answers in the
5-question planner are **simulated locally**. Your profile and dates are stored
in `localStorage` on your device.

## Run it

Any static file server works — no build step:

```bash
npx serve .          # or: python3 -m http.server 8080
```

Open `http://localhost:8080`. To be installable as a PWA (service worker,
offline, home-screen icon) it must be served from `localhost` or **HTTPS** —
GitHub Pages, Netlify, Vercel etc. all work as-is.

### Install as an app

- **Android / Chrome:** menu → *Install app* (or the button in Settings ⚙️)
- **iPhone / Safari:** Share → *Add to Home Screen*
- **Desktop Chrome/Edge:** install icon in the address bar

## Features in this prototype

- 📲 Full PWA: `manifest.webmanifest`, offline service worker, maskable icons, app shortcuts
- 🌍 3 languages: English, Deutsch, Русский (auto-detected, switchable in settings)
- 🪪 Onboarding with photo + animated "authentication check", verified badge
- 🔎 Radius filter (1–10 km), live online presence, badge counters
- 📅 The complete 5-question date planner incl. counter-proposals and the 🪙 coin flip
- 🎉 Match screen, heart bursts, toasts — everything animated
- 🔒 No external requests at all: fonts, avatars and icons are generated locally

## Project structure

```
index.html            app shell (onboarding + 4 sections)
css/styles.css        the whole design system
js/i18n.js            EN/DE/RU strings
js/data.js            demo people + generated SVG avatars
js/app.js             state, rendering, date-planner wizard, simulation
sw.js                 offline cache
manifest.webmanifest  PWA manifest
tools/gen-icons.mjs   dependency-free PNG icon generator (node tools/gen-icons.mjs)
```

## Roadmap (to make it real)

- Backend: accounts, real geolocation search, presence (WebSocket), likes & date scheduling
- Real photo verification (liveness check)
- Push notifications for likes, matches and date reminders
- One-time purchase flow
