# Feature: Data Export

**Status**: Implemented

**Date**: 7-3-2026

> **Design Doc Philosophy**: This document describes WHAT the feature does and WHY, from a user perspective. Technical implementation details (HOW) are tracked in specs. Keep this doc user-focused, concise, and free of code/implementation specifics.

## Overview

Data Export lets users download their complete training history as a JSON file directly from the app. It is a safety net — a way to own your data and take it with you regardless of what happens to the app or service.

## Problem Statement

All training data lives in Supabase. Users have no offline copy and no way to access their history if they stop using the app, lose account access, or want to analyze their data outside Parakeet.

- No offline backup of training history
- Data is inaccessible without an active account and internet connection
- No path to migrate data to another tool

## User Experience

### Primary Flow

1. User opens **Settings** and taps **Export Data**
2. App assembles a snapshot of all completed sessions and their logged sets
3. System share sheet opens with a file named `parakeet-export-YYYY-MM-DD.json`
4. User saves to Files, emails to themselves, or shares wherever they want

### Edge Cases

- **No data yet** — export still works; the file is valid JSON with an empty sessions array and a note indicating no completed sessions exist
- **Large history** — a brief loading state while the file is assembled before the share sheet opens

### Visual Design Notes

- Single "Export Data" row in Settings (Account section)
- Tapping it triggers the export immediately — no configuration screen needed
- Share sheet is the native OS mechanism; no custom UI required

## Data Included

The export covers completed workout sessions and the sets performed within them:

- Session date, lift, intensity type, and completion timestamp
- Session RPE (if recorded)
- Each main set: weight (in kg), reps completed, RPE if recorded
- Auxiliary sets (raw, as logged)

Config data (formula history, volume targets, program structure) is not included — this export is a training log, not a full system backup.

## User Benefits

**Data ownership**: Your training history belongs to you, not to a service account.

**Peace of mind**: A copy exists outside the app, regardless of what happens to the service.

**Portability**: Raw JSON is structured and machine-readable — usable in spreadsheets, scripts, or any future tool.

## References

- Related Design Doc: [csv-import.md](./csv-import.md) — the import counterpart; export format should be compatible where possible
- Spec: [mobile-032-data-export.md](../specs/09-mobile/mobile-032-data-export.md)
