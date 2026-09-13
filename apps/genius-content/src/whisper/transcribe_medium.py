import json
import sys
from pathlib import Path

import whisper


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")

    if len(sys.argv) < 2:
        raise SystemExit("Usage: python src/whisper/transcribe_medium.py <video_path>")

    input_path = Path(sys.argv[1]).resolve()
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    model = whisper.load_model("medium")
    result = model.transcribe(
        str(input_path),
        language="pl",
        task="transcribe",
        word_timestamps=True,
        verbose=False,
        fp16=False,
    )
    sys.stdout.write(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
