# Orbit

Monorepo for the Orbit mobile app and website.

## Structure

```
apps/
  mobile/   — Expo / React Native app
  web/      — Astro landing page & privacy policy
```

## Setup

```bash
npm install
```

## Mobile App

```bash
npm run mobile            # start Expo dev server
npm run mobile:android    # start on Android
npm run mobile:ios        # start on iOS
```

## Website

```bash
npm run web:dev       # start Astro dev server
npm run web:build     # production build
npm run web:preview   # preview production build
```

## Stack

- **Mobile** — Expo 54, React Native, expo-sqlite, TypeScript
- **Web** — Astro, TypeScript
