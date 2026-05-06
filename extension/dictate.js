// Standalone dictation for the Chrome extension popup.
// Records mic audio with MediaRecorder, then sends the blob to our
// elevenlabs-transcribe edge function (which proxies to ElevenLabs Scribe v2).
// Pause/resume use the native MediaRecorder.pause()/resume(). When stopped,
// the full blob is transcribed and appended to the on-screen transcript.

const SUPABASE_URL = "https://urwovlmueuxgolccrjhb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyd292bG11ZXV4Z29sY2NyamhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODQ5NjksImV4cCI6MjA5MzY2MDk2OX0.ZsyR95ouctn7Kq5QvO6dj0JTGFuu5A2b9u9tT8kuElU";
const TRANSCRIBE_URL = `${SUPABASE_URL}/functions/v1/elevenlabs-transcribe`;

const els = {
  record: document.getElementById("record"),
  stop: document.getElementById("stop"),
  pause: document.getElementById("pause"),
  resume: document.getElementById("resume"),
  copy: document.getElementById("copy"),
  clear: document.getElementById("clear"),
  transcript: document.getElementById("transcript"),
  status: document.getElementById("status"),
  dots: document.getElementById("dots"),
  error: document.getElementById("error"),
};

let mediaRecorder = null;
let stream = null;
let chunks = [];
let transcript = "";
let state = "idle"; // idle | recording | paused | transcribing

function setStatus(s) {
  state = s;
  const map = {
    idle: "Idle",
    recording: "Listening",
    paused: "Paused",
    transcribing: "Transcribing…",
  };
  els.status.textContent = map[s] ?? s;
  els.dots.classList.toggle("live", s === "recording");

  els.record.style.display = s === "idle" ? "" : "none";
  els.stop.style.display = s === "recording" || s === "paused" ? "" : "none";
  els.pause.style.display = s === "recording" ? "" : "none";
  els.resume.style.display = s === "paused" ? "" : "none";
  els.record.disabled = s === "transcribing";
  els.stop.disabled = s === "transcribing";
}

function showError(msg) {
  if (!msg) {
    els.error.style.display = "none";
    els.error.textContent = "";
    return;
  }
  els.error.style.display = "";
  els.error.textContent = msg;
}

function renderTranscript() {
  if (transcript) {
    els.transcript.classList.remove("empty");
    els.transcript.textContent = transcript;
    els.copy.disabled = false;
    els.clear.disabled = false;
  } else {
    els.transcript.classList.add("empty");
    els.transcript.textContent = "Press record and start speaking…";
    els.copy.disabled = true;
    els.clear.disabled = true;
  }
}

function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

async function startRecording() {
  showError("");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
    });
  } catch (e) {
    showError(
      "Microphone access denied. Click the 🔒 icon next to the URL bar and allow microphone for this extension."
    );
    return;
  }

  chunks = [];
  const mimeType = pickMimeType();
  try {
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (e) {
    showError("Could not start recorder: " + (e?.message ?? e));
    stream.getTracks().forEach((t) => t.stop());
    return;
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.onstop = handleStop;
  mediaRecorder.start();
  setStatus("recording");
}

function pauseRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    setStatus("paused");
  }
}

function resumeRecording() {
  if (mediaRecorder && mediaRecorder.state === "paused") {
    mediaRecorder.resume();
    setStatus("recording");
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop(); // triggers handleStop
  }
}

async function handleStop() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  const mimeType = mediaRecorder?.mimeType || "audio/webm";
  const blob = new Blob(chunks, { type: mimeType });
  chunks = [];
  mediaRecorder = null;

  if (blob.size < 1000) {
    setStatus("idle");
    showError("Recording was too short — try again.");
    return;
  }

  setStatus("transcribing");
  try {
    const form = new FormData();
    const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
    form.append("file", blob, `clip.${ext}`);
    const res = await fetch(TRANSCRIBE_URL, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    const text = (data?.text ?? "").trim();
    if (text) {
      transcript = transcript ? `${transcript} ${text}` : text;
      renderTranscript();
    } else {
      showError("No speech detected.");
    }
  } catch (e) {
    showError("Transcription failed: " + (e?.message ?? e));
  } finally {
    setStatus("idle");
  }
}

async function copyTranscript() {
  if (!transcript) return;
  try {
    await navigator.clipboard.writeText(transcript);
    els.copy.textContent = "✓";
    setTimeout(() => (els.copy.textContent = "⧉"), 1200);
  } catch (e) {
    showError("Clipboard write failed: " + (e?.message ?? e));
  }
}

function clearTranscript() {
  transcript = "";
  renderTranscript();
  showError("");
}

els.record.addEventListener("click", startRecording);
els.stop.addEventListener("click", stopRecording);
els.pause.addEventListener("click", pauseRecording);
els.resume.addEventListener("click", resumeRecording);
els.copy.addEventListener("click", copyTranscript);
els.clear.addEventListener("click", clearTranscript);

setStatus("idle");
renderTranscript();
