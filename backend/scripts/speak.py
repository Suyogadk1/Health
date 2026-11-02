import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python_packages"))
import edge_tts

VOICES = {"en-US": "en-US-JennyNeural", "hi-IN": "hi-IN-SwaraNeural", "ta-IN": "ta-IN-PallaviNeural", "te-IN": "te-IN-ShrutiNeural", "ne-NP": "ne-NP-HemkalaNeural"}

async def main():
    data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    speech = edge_tts.Communicate(data["text"], VOICES[data["language"]], rate="-5%")
    async for chunk in speech.stream():
        if chunk["type"] == "audio":
            sys.stdout.buffer.write(chunk["data"])
            sys.stdout.buffer.flush()

if __name__ == "__main__":
    asyncio.run(main())
