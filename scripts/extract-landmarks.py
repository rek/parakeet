#!/usr/bin/env python3
"""
Extract MediaPipe pose landmarks from test videos and write them as JSON fixtures.

Usage:
    python3 scripts/extract-landmarks.py [--force]

Prerequisites:
    pip install mediapipe opencv-python

Reads test-videos/manifest.json to discover videos, extracts frames at 4fps,
runs MediaPipe PoseLandmarker (Lite model) on each frame, and writes
per-video landmark files to test-videos/landmarks/<video-id>.landmarks.json.

The model file (pose_landmarker_lite.task, ~5.6MB) is downloaded automatically
on first run to test-videos/landmarks/.model/.

Output format per file:
    {
      "videoId": "squat-side-clean",
      "fps": 4,
      "totalFrames": 82,
      "validFrames": 78,
      "frames": [
        [{"x": 0.456789, "y": 0.234567, "z": -0.012345, "visibility": 0.998765}, ...],
        ...
      ]
    }

Each inner array has exactly 33 entries (MediaPipe landmark indices 0-32).
Failed detections produce 33 zero landmarks with visibility 0.
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths — resolved relative to this script's location, not cwd
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
VIDEOS_DIR = PROJECT_ROOT / "test-videos"
LANDMARKS_DIR = VIDEOS_DIR / "landmarks"
MANIFEST_PATH = VIDEOS_DIR / "manifest.json"
MODEL_DIR = LANDMARKS_DIR / ".model"
MODEL_PATH = MODEL_DIR / "pose_landmarker_lite.task"
MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"

EXTRACT_FPS = 4
N_LANDMARKS = 33
DETECTION_WARN_THRESHOLD = 0.50  # warn if valid-frame rate drops below 50%

# 33 zero landmarks used when MediaPipe fails to detect a pose
EMPTY_FRAME = [{"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0}] * N_LANDMARKS


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract MediaPipe pose landmarks from test videos."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-extract even if the landmark file already exists.",
    )
    return parser.parse_args()


def load_manifest() -> list[dict]:
    """Load and return the videos list from manifest.json."""
    with open(MANIFEST_PATH, "r") as f:
        manifest = json.load(f)
    return manifest["videos"]


def ensure_model() -> str:
    """Download the PoseLandmarker Lite model if not cached. Returns the path."""
    if MODEL_PATH.exists():
        return str(MODEL_PATH)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading PoseLandmarker Lite model to {MODEL_PATH}...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    size_mb = MODEL_PATH.stat().st_size / (1024 * 1024)
    print(f"Downloaded ({size_mb:.1f}MB)")
    return str(MODEL_PATH)


def extract_landmarks_for_video(
    video_entry: dict, landmarker, force: bool
) -> dict:
    """
    Extract pose landmarks from a single video.

    Returns a result dict with keys:
        videoId, fps, totalFrames, validFrames, frames, skipped, error
    """
    import cv2
    import mediapipe as mp

    video_id: str = video_entry["id"]
    video_file: str = video_entry["file"]
    video_path = VIDEOS_DIR / video_file
    output_path = LANDMARKS_DIR / f"{video_id}.landmarks.json"

    result_meta = {"videoId": video_id, "skipped": False, "error": None}

    # ------------------------------------------------------------------
    # Guard: video file must exist
    # ------------------------------------------------------------------
    if not video_path.exists():
        result_meta["error"] = f"video file not found: {video_path}"
        return result_meta

    # ------------------------------------------------------------------
    # Guard: skip if already extracted (unless --force)
    # ------------------------------------------------------------------
    if output_path.exists() and not force:
        result_meta["skipped"] = True
        return result_meta

    # ------------------------------------------------------------------
    # Open video and compute frame timestamps at EXTRACT_FPS
    # ------------------------------------------------------------------
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        result_meta["error"] = f"cv2 could not open: {video_path}"
        return result_meta

    try:
        source_fps = max(cap.get(cv2.CAP_PROP_FPS), 1.0)
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration_ms = (frame_count / source_fps) * 1000.0
        interval_ms = 1000.0 / EXTRACT_FPS

        # Build list of timestamps to sample
        timestamps_ms: list[float] = []
        t = 0.0
        while t <= duration_ms:
            timestamps_ms.append(t)
            t += interval_ms

        frames: list[list[dict]] = []
        valid_count = 0

        for ts_ms in timestamps_ms:
            cap.set(cv2.CAP_PROP_POS_MSEC, ts_ms)
            ret, bgr_frame = cap.read()

            if not ret or bgr_frame is None:
                frames.append(EMPTY_FRAME)
                continue

            # MediaPipe expects RGB
            rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            result = landmarker.detect(image)

            if not result.pose_landmarks or len(result.pose_landmarks) == 0:
                frames.append(EMPTY_FRAME)
                continue

            # Take the first detected pose
            pose = result.pose_landmarks[0]
            landmarks = []
            for lm in pose:
                landmarks.append(
                    {
                        "x": round(lm.x, 6),
                        "y": round(lm.y, 6),
                        "z": round(lm.z, 6),
                        "visibility": round(lm.visibility, 6),
                    }
                )

            frames.append(landmarks)
            valid_count += 1

    finally:
        cap.release()

    total_frames = len(frames)

    # ------------------------------------------------------------------
    # Warn if detection rate is poor
    # ------------------------------------------------------------------
    detection_rate = valid_count / total_frames if total_frames > 0 else 0.0
    if detection_rate < DETECTION_WARN_THRESHOLD:
        print(
            f"WARNING: {video_id} — low detection rate "
            f"({valid_count}/{total_frames} = {detection_rate:.0%})",
            file=sys.stderr,
        )

    # ------------------------------------------------------------------
    # Write output
    # ------------------------------------------------------------------
    output = {
        "videoId": video_id,
        "fps": EXTRACT_FPS,
        "totalFrames": total_frames,
        "validFrames": valid_count,
        "frames": frames,
    }

    LANDMARKS_DIR.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(output, f, indent=None, separators=(",", ":"))

    result_meta.update(
        {
            "totalFrames": total_frames,
            "validFrames": valid_count,
            "detectionRate": detection_rate,
        }
    )
    return result_meta


def print_summary(results: list[dict]) -> None:
    """Print a formatted summary table to stdout."""
    col_id = 28
    col_frames = 12
    col_valid = 12
    col_rate = 8
    col_status = 10

    header = (
        f"{'videoId':<{col_id}}"
        f"{'totalFrames':>{col_frames}}"
        f"{'validFrames':>{col_valid}}"
        f"{'rate':>{col_rate}}"
        f"{'status':>{col_status}}"
    )
    separator = "-" * len(header)

    print()
    print(header)
    print(separator)

    for r in results:
        video_id = r["videoId"]

        if r.get("error"):
            status = "ERROR"
            row = (
                f"{video_id:<{col_id}}"
                f"{'—':>{col_frames}}"
                f"{'—':>{col_valid}}"
                f"{'—':>{col_rate}}"
                f"{status:>{col_status}}"
            )
        elif r.get("skipped"):
            status = "skipped"
            row = (
                f"{video_id:<{col_id}}"
                f"{'—':>{col_frames}}"
                f"{'—':>{col_valid}}"
                f"{'—':>{col_rate}}"
                f"{status:>{col_status}}"
            )
        else:
            total = r.get("totalFrames", 0)
            valid = r.get("validFrames", 0)
            rate_pct = f"{r.get('detectionRate', 0):.0%}"
            status = "ok"
            row = (
                f"{video_id:<{col_id}}"
                f"{total:>{col_frames}}"
                f"{valid:>{col_valid}}"
                f"{rate_pct:>{col_rate}}"
                f"{status:>{col_status}}"
            )

        print(row)

    print()


def main() -> None:
    args = parse_args()

    # ------------------------------------------------------------------
    # Import heavy dependencies after arg parsing so --help is instant
    # ------------------------------------------------------------------
    try:
        import cv2  # noqa: F401 — imported for side-effect check
        from mediapipe.tasks.python import vision, BaseOptions
    except ImportError as e:
        print(
            f"ERROR: Missing dependency — {e}\n"
            "Install with: pip install mediapipe opencv-python",
            file=sys.stderr,
        )
        sys.exit(1)

    videos = load_manifest()

    # ------------------------------------------------------------------
    # Pre-flight: check all video files exist before doing any work
    # ------------------------------------------------------------------
    missing = [
        v["file"] for v in videos if not (VIDEOS_DIR / v["file"]).exists()
    ]
    if missing:
        for f in missing:
            print(f"ERROR: missing video file: {VIDEOS_DIR / f}", file=sys.stderr)
        sys.exit(1)

    LANDMARKS_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Download model if needed, then create PoseLandmarker
    # ------------------------------------------------------------------
    model_path = ensure_model()

    options = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
    )
    landmarker = vision.PoseLandmarker.create_from_options(options)

    try:
        results = []
        for video_entry in videos:
            video_id = video_entry["id"]
            print(f"Processing {video_id}...", end=" ", flush=True)

            result = extract_landmarks_for_video(video_entry, landmarker, args.force)
            results.append(result)

            if result.get("error"):
                print(f"ERROR: {result['error']}")
            elif result.get("skipped"):
                print("skipped (use --force to re-extract)")
            else:
                print(
                    f"{result['validFrames']}/{result['totalFrames']} frames "
                    f"({result['detectionRate']:.0%} detection)"
                )
    finally:
        landmarker.close()

    print_summary(results)

    # Exit 1 if any video had an error
    if any(r.get("error") for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
