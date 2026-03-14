# Orbit

Orbit is a minimal personal CRM built with Expo and React Native. It stores people and meeting notes locally on-device.

## Features

- Local-first people records
- Structured meeting notes plus freeform notes
- Single-screen workflow intended for fast entry

## Run

```bash
npm install
npm start
```

## APK Build Workflow

This repo includes a GitHub Actions workflow at `.github/workflows/android-apk.yml`.

- Trigger it manually from the Actions tab with `Build Android APK`
- Or push a Git tag like `v1.0.0`
- The workflow prebuilds Android, runs Gradle, and uploads an installable debug APK as a workflow artifact

The uploaded artifact name is based on the app version from `app.json`.

## Stack

- Expo
- React Native
- Expo SQLite for local persistence
