# Test Videos

Calibration suite for the video form analysis pipeline. Contains real landmark data extracted from device recordings, used to validate rep detection, metric computation, and fault detection.

## Directory Structure

```
test-videos/
  manifest.json           # Video metadata + expected ranges + actual calibrated values
  landmarks/              # PoseFrame[] fixtures extracted from real videos
    <video-id>.landmarks.json
  snapshots/              # Full analysis result snapshots for regression testing
    <video-id>.snapshot.json
```

## Running Tests

```bash
npx nx test parakeet -- calibration       # Run calibration test suite
```

## Adding a New Test Video

1. Record a video on device with debug landmarks enabled
2. Pull landmarks: `SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run pull:device-analysis`
3. Rename the landmark file to a descriptive id (e.g., `squat-side-3reps.landmarks.json`)
4. Add an entry to `manifest.json` with expected ranges
5. Run calibration: `npm run calibrate:videos`
6. Review the output, commit

## Calibration Workflow

```bash
# Inspect: run pipeline, update manifest actual values
npm run calibrate:videos

# Full re-calibration: update manifest + snapshots + mark calibrated
npm run calibrate:snapshots
```

After an intentional algorithm change:

1. Run `npm run calibrate:snapshots` to regenerate all snapshots
2. Review the git diff of `manifest.json` and `snapshots/` — verify changes are expected
3. Commit the updated snapshots as the new regression baseline

## Regression Testing

Videos marked `"calibrated": true` in the manifest get full regression testing:
- **Exact match:** rep count, analysis version, sagittal confidence
- **Tolerance-based snapshot comparison:** per-rep metrics compared within tolerances (angles +/-5 deg, distances +/-2cm, velocity/timing +/-10%, faults exact set match)

If a test fails, the console output shows which fields drifted and by how much.

## Script Options

```
npx tsx scripts/calibrate-videos.ts [options]

  --video <id>        Run for a single video only
  --update-manifest   Write actual values back to manifest.json
  --mark-calibrated   Set calibrated: true for videos within expected ranges
  --dry-run           Print what would be written without writing
  --force             Overwrite existing snapshots
```
