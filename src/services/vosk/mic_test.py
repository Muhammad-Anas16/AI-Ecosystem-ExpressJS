import json
import os
import pyaudio
from vosk import KaldiRecognizer, Model

MODEL_PATH = os.getenv(
    "VOSK_MODEL_PATH",
    os.path.join("models", "vosk", "vosk-model-small-en-us-0.15"),
)

RATE = 16000
CHUNK = 4000

model = Model(MODEL_PATH)
recognizer = KaldiRecognizer(model, RATE)

audio = pyaudio.PyAudio()
stream = audio.open(
    format=pyaudio.paInt16,
    channels=1,
    rate=RATE,
    input=True,
    frames_per_buffer=CHUNK,
)

print("PyAudio + Vosk microphone test. Press Ctrl+C to stop.")

try:
    while True:
        data = stream.read(CHUNK, exception_on_overflow=False)
        if recognizer.AcceptWaveform(data):
            result = json.loads(recognizer.Result())
            if result.get("text"):
                print(result["text"])
        else:
            partial = json.loads(recognizer.PartialResult()).get("partial", "")
            if partial:
                print("\r" + partial, end="", flush=True)
except KeyboardInterrupt:
    print("\nStopped.")
finally:
    stream.stop_stream()
    stream.close()
    audio.terminate()
