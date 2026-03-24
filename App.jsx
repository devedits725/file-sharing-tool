import { useState, useRef, useCallback, useEffect } from "react";

const API = "";

// ───────────────────────────────────────────
// UTILS
// ───────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

// ───────────────────────────────────────────
// API CALLS
// ───────────────────────────────────────────
async function apiCreateRoom(file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/rooms/create`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const res = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (xhr.status === 200) resolve(res);
        else {
          let msg = res.detail || `Upload failed (Status: ${xhr.status})`;
          if (xhr.status === 404) msg += " - Backend not found. Check your vercel.json or API URL.";
          reject(new Error(msg));
        }
      } catch (e) {
        let msg = `Failed to parse server response (Status: ${xhr.status})`;
        if (xhr.status === 404) msg += " - Backend not found. Check your vercel.json or API URL.";
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error or server unreachable"));
    xhr.send(form);
  });
}

async function apiGetRoom(code) {
  const res = await fetch(`${API}/rooms/${code.toUpperCase()}`);
  if (res.status === 404) {
    // Distinguish between "Room not found" (API returned 404) and "API not found" (Proxy/Vercel returned 404)
    const data = await res.json().catch(() => null);
    if (data && data.detail) throw new Error(data.detail);
    throw new Error("Room not found (or Backend unreachable). Check the code and your deployment config.");
  }
  if (res.status === 410) throw new Error("This room has expired.");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Something went wrong (Status: ${res.status})`);
  }
  return data;
}

async function apiDeleteRoom(code) {
  const res = await fetch(`${API}/rooms/${code.toUpperCase()}`, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = data.detail || `Failed to delete room (Status: ${res.status})`;
    if (res.status === 404) msg += " - Backend not found.";
    throw new Error(msg);
  }
  return data;
}

// ───────────────────────────────────────────
// STYLES (injected once)
// ───────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #0a0a0f;
    --surface:  #111118;
    --border:   #1f1f2e;
    --accent:   #7c3aed;
    --accent2:  #06b6d4;
    --green:    #22c55e;
    --red:      #ef4444;
    --muted:    #4b5563;
    --text:     #e2e8f0;
    --sub:      #94a3b8;
    --mono:     'Space Mono', monospace;
    --sans:     'Syne', sans-serif;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* animated grid bg */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
    z-index: 0;
  }

  #root { position: relative; z-index: 1; }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 16px 80px;
  }

  /* HEADER */
  .header {
    text-align: center;
    margin-bottom: 56px;
  }
  .header-badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent2);
    border: 1px solid var(--accent2);
    padding: 4px 12px;
    border-radius: 2px;
    margin-bottom: 20px;
    opacity: 0.8;
  }
  .header h1 {
    font-size: clamp(36px, 6vw, 64px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
    background: linear-gradient(135deg, #fff 0%, var(--accent) 60%, var(--accent2) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .header p {
    margin-top: 12px;
    color: var(--sub);
    font-size: 15px;
    font-family: var(--mono);
  }

  /* CARD */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 32px;
    width: 100%;
    max-width: 520px;
    position: relative;
    overflow: hidden;
  }
  .card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.5;
  }

  .card + .card {
    margin-top: 20px;
  }

  .card-title {
    font-size: 11px;
    font-family: var(--mono);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .card-title::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* TABS */
  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    width: 100%;
    max-width: 520px;
    margin-bottom: 4px;
  }
  .tab {
    flex: 1;
    padding: 12px;
    font-family: var(--mono);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    background: var(--surface);
    color: var(--muted);
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }
  .tab.active {
    background: var(--accent);
    color: #fff;
  }
  .tab:hover:not(.active) {
    background: var(--border);
    color: var(--text);
  }

  /* DROP ZONE */
  .dropzone {
    border: 2px dashed var(--border);
    border-radius: 8px;
    padding: 40px 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  .dropzone.drag-over {
    border-color: var(--accent);
    background: rgba(124,58,237,0.05);
  }
  .dropzone:hover {
    border-color: var(--accent);
  }
  .dropzone-icon {
    font-size: 36px;
    margin-bottom: 12px;
    display: block;
  }
  .dropzone-text {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--sub);
    line-height: 1.8;
  }
  .dropzone-text strong {
    color: var(--accent2);
  }
  .dropzone input[type=file] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  /* FILE PREVIEW */
  .file-preview {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(124,58,237,0.07);
    border: 1px solid rgba(124,58,237,0.2);
    border-radius: 8px;
    margin-top: 16px;
  }
  .file-preview-icon {
    font-size: 28px;
    flex-shrink: 0;
  }
  .file-preview-info {
    flex: 1;
    overflow: hidden;
  }
  .file-preview-name {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .file-preview-size {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }
  .file-preview-remove {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 18px;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.2s;
  }
  .file-preview-remove:hover { color: var(--red); }

  /* PROGRESS BAR */
  .progress-wrap {
    margin-top: 16px;
  }
  .progress-label {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--sub);
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
  }
  .progress-bar {
    height: 4px;
    background: var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent2));
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  /* BUTTONS */
  .btn {
    width: 100%;
    margin-top: 20px;
    padding: 14px;
    border: none;
    border-radius: 8px;
    font-family: var(--mono);
    font-size: 13px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn-primary {
    background: var(--accent);
    color: #fff;
  }
  .btn-primary:hover:not(:disabled) {
    background: #6d28d9;
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(124,58,237,0.3);
  }
  .btn-primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: transparent;
    color: var(--sub);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover {
    border-color: var(--muted);
    color: var(--text);
  }
  .btn-danger {
    background: transparent;
    color: var(--red);
    border: 1px solid rgba(239,68,68,0.3);
    margin-top: 10px;
  }
  .btn-danger:hover {
    background: rgba(239,68,68,0.08);
  }
  .btn-green {
    background: var(--green);
    color: #000;
    font-weight: 700;
    margin-top: 10px;
  }
  .btn-green:hover {
    background: #16a34a;
    transform: translateY(-1px);
  }

  /* INPUT */
  .input-wrap { position: relative; }
  .input-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }
  .input {
    width: 100%;
    padding: 13px 16px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 20px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    text-align: center;
    outline: none;
    transition: border-color 0.2s;
  }
  .input::placeholder {
    color: var(--muted);
    letter-spacing: 0.1em;
    font-size: 14px;
    text-transform: none;
  }
  .input:focus { border-color: var(--accent); }

  /* ROOM CODE DISPLAY */
  .room-code-display {
    text-align: center;
    padding: 28px 16px;
  }
  .room-code-label {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
  }
  .room-code-chars {
    display: flex;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .room-code-char {
    width: 52px;
    height: 60px;
    background: var(--bg);
    border: 1px solid var(--accent);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--mono);
    font-size: 26px;
    font-weight: 700;
    color: var(--accent2);
    box-shadow: 0 0 12px rgba(124,58,237,0.15);
    animation: popIn 0.3s ease backwards;
  }
  @keyframes popIn {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  /* COPY BUTTON */
  .copy-row {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .copy-btn {
    flex: 1;
    padding: 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--sub);
    font-family: var(--mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.2s;
  }
  .copy-btn:hover { border-color: var(--accent2); color: var(--accent2); }
  .copy-btn.copied { border-color: var(--green); color: var(--green); }

  /* FILE META */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }
  .meta-item {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 12px;
  }
  .meta-item-label {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .meta-item-value {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--text);
    word-break: break-all;
  }

  /* ALERTS */
  .alert {
    padding: 12px 14px;
    border-radius: 6px;
    font-family: var(--mono);
    font-size: 12px;
    margin-top: 16px;
    display: flex;
    align-items: flex-start;
    gap: 8px;
    line-height: 1.5;
  }
  .alert-error {
    background: rgba(239,68,68,0.07);
    border: 1px solid rgba(239,68,68,0.25);
    color: #fca5a5;
  }
  .alert-success {
    background: rgba(34,197,94,0.07);
    border: 1px solid rgba(34,197,94,0.25);
    color: #86efac;
  }

  /* DOWNLOAD count badge */
  .dl-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--accent2);
    background: rgba(6,182,212,0.08);
    border: 1px solid rgba(6,182,212,0.2);
    border-radius: 4px;
    padding: 2px 8px;
    margin-left: 8px;
  }

  /* SPINNER */
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* EXPIRY bar */
  .expiry-bar-wrap {
    margin-top: 16px;
  }
  .expiry-bar-label {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
  }
  .expiry-bar {
    height: 3px;
    background: var(--border);
    border-radius: 999px;
    overflow: hidden;
  }
  .expiry-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--green), var(--accent2));
    border-radius: 999px;
  }

  @media (max-width: 480px) {
    .card { padding: 24px 20px; }
    .room-code-char { width: 44px; height: 52px; font-size: 22px; }
    .meta-grid { grid-template-columns: 1fr; }
  }
`;

function getFileIcon(mime = "") {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime.includes("pdf"))      return "📄";
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar")) return "🗜️";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("sheet") || mime.includes("excel"))   return "📊";
  return "📁";
}

// ───────────────────────────────────────────
// COMPONENT: RoomCodeDisplay
// ───────────────────────────────────────────
function RoomCodeDisplay({ code }) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${code}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="room-code-display">
      <div className="room-code-label">Your Room Code</div>
      <div className="room-code-chars">
        {code.split("").map((ch, i) => (
          <div
            key={i}
            className="room-code-char"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            {ch}
          </div>
        ))}
      </div>
      <div className="copy-row" style={{ marginTop: 20 }}>
        <button
          className={`copy-btn ${copied ? "copied" : ""}`}
          onClick={copyCode}
        >
          {copied ? "✓ Copied!" : "Copy Code"}
        </button>
        <button
          className={`copy-btn ${copiedLink ? "copied" : ""}`}
          onClick={copyLink}
        >
          {copiedLink ? "✓ Copied!" : "Copy Link"}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// COMPONENT: CreateRoom
// ───────────────────────────────────────────
function CreateRoom() {
  const [file, setFile]         = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError("");
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress(0);
    try {
      const data = await apiCreateRoom(file, setProgress);
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!result) return;
    try {
      await apiDeleteRoom(result.room_code);
      setResult(null);
      setFile(null);
      setProgress(0);
    } catch (e) {
      setError(e.message);
    }
  };

  const expiryPct = result
    ? Math.max(
        0,
        ((new Date(result.expires_at) - new Date()) /
          (24 * 60 * 60 * 1000)) *
          100
      )
    : 100;

  return (
    <div>
      {!result ? (
        <>
          <div
            className={`dropzone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <span className="dropzone-icon">📤</span>
            <div className="dropzone-text">
              <strong>Click to browse</strong> or drag a file here
              <br />Any file type · Up to any size
            </div>
            <input
              ref={inputRef}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {file && (
            <div className="file-preview">
              <div className="file-preview-icon">{getFileIcon(file.type)}</div>
              <div className="file-preview-info">
                <div className="file-preview-name">{file.name}</div>
                <div className="file-preview-size">{formatBytes(file.size)}</div>
              </div>
              <button
                className="file-preview-remove"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >✕</button>
            </div>
          )}

          {uploading && (
            <div className="progress-wrap">
              <div className="progress-label">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && (
            <div className="alert alert-error">⚠️ {error}</div>
          )}

          <button
            className="btn btn-primary"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? <><span className="spinner" /> Creating Room…</> : "⚡ Create Room"}
          </button>
        </>
      ) : (
        <>
          <div className="alert alert-success">
            ✅ Room created! Share the code below with anyone.
          </div>

          <RoomCodeDisplay code={result.room_code} />

          <div className="meta-grid">
            <div className="meta-item">
              <div className="meta-item-label">File</div>
              <div className="meta-item-value">{getFileIcon(result.mime_type)} {result.file_name}</div>
            </div>
            <div className="meta-item">
              <div className="meta-item-label">Size</div>
              <div className="meta-item-value">{formatBytes(result.file_size)}</div>
            </div>
            <div className="meta-item">
              <div className="meta-item-label">Expires</div>
              <div className="meta-item-value">{timeLeft(result.expires_at)}</div>
            </div>
            <div className="meta-item">
              <div className="meta-item-label">Downloads</div>
              <div className="meta-item-value">{result.download_count}</div>
            </div>
          </div>

          <div className="expiry-bar-wrap">
            <div className="expiry-bar-label">
              <span>Room lifetime</span>
              <span>{timeLeft(result.expires_at)}</span>
            </div>
            <div className="expiry-bar">
              <div className="expiry-fill" style={{ width: `${expiryPct}%` }} />
            </div>
          </div>

          <button className="btn btn-secondary" onClick={() => { setFile(null); setResult(null); }}>
            ＋ Create Another Room
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            🗑 Close & Delete Room
          </button>
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────
// COMPONENT: JoinRoom
// ───────────────────────────────────────────
function JoinRoom({ initialCode = "" }) {
  const [code, setCode]       = useState(initialCode);
  const [room, setRoom]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [dlMsg, setDlMsg]     = useState("");

  const handleJoin = async () => {
    if (code.trim().length < 6) return;
    setLoading(true);
    setError("");
    setRoom(null);
    setDlMsg("");
    try {
      const data = await apiGetRoom(code.trim());
      setRoom(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.open(`${API}/rooms/${room.room_code}/download`, "_blank");
    setDlMsg("Download started!");
    setRoom((r) => ({ ...r, download_count: r.download_count + 1 }));
    setTimeout(() => setDlMsg(""), 3000);
  };

  const expiryPct = room
    ? Math.max(
        0,
        ((new Date(room.expires_at) - new Date()) / (24 * 60 * 60 * 1000)) * 100
      )
    : 100;

  return (
    <div>
      <div className="input-label">Enter Room Code</div>
      <input
        className="input"
        placeholder="e.g. XK92PL"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
          setRoom(null);
          setError("");
        }}
        onKeyDown={(e) => e.key === "Enter" && handleJoin()}
      />

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      <button
        className="btn btn-primary"
        disabled={code.length < 6 || loading}
        onClick={handleJoin}
      >
        {loading ? <><span className="spinner" /> Looking up room…</> : "🔍 Join Room"}
      </button>

      {room && (
        <>
          <div style={{ marginTop: 24 }}>
            <div className="card-title">
              Room {room.room_code}
            </div>
            <div className="file-preview" style={{ marginTop: 0 }}>
              <div className="file-preview-icon">{getFileIcon(room.mime_type)}</div>
              <div className="file-preview-info">
                <div className="file-preview-name">{room.file_name}</div>
                <div className="file-preview-size">
                  {formatBytes(room.file_size)}
                  <span className="dl-badge">⬇ {room.download_count}</span>
                </div>
              </div>
            </div>

            <div className="meta-grid">
              <div className="meta-item">
                <div className="meta-item-label">Type</div>
                <div className="meta-item-value">{room.mime_type?.split("/")[1] || "file"}</div>
              </div>
              <div className="meta-item">
                <div className="meta-item-label">Expires</div>
                <div className="meta-item-value">{timeLeft(room.expires_at)}</div>
              </div>
            </div>

            <div className="expiry-bar-wrap">
              <div className="expiry-bar-label">
                <span>Time remaining</span>
                <span>{timeLeft(room.expires_at)}</span>
              </div>
              <div className="expiry-bar">
                <div className="expiry-fill" style={{ width: `${expiryPct}%` }} />
              </div>
            </div>

            {dlMsg && <div className="alert alert-success">✅ {dlMsg}</div>}

            <button className="btn btn-green" onClick={handleDownload}>
              ⬇ Download File
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────────────────────────
// ROOT APP
// ───────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("send");

  // Auto-fill room code from URL ?room=XXXXXX
  const urlRoom = new URLSearchParams(window.location.search).get("room");

  useEffect(() => {
    if (urlRoom && tab !== "receive") setTab("receive");
  }, [urlRoom]);

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <header className="header">
          <div className="header-badge">Peer File Transfer</div>
          <h1>DropRoom</h1>
          <p>Upload a file → get a room code → anyone can receive it</p>
        </header>

        <div className="tabs">
          <button
            className={`tab ${tab === "send" ? "active" : ""}`}
            onClick={() => setTab("send")}
          >
            📤 Send File
          </button>
          <button
            className={`tab ${tab === "receive" ? "active" : ""}`}
            onClick={() => setTab("receive")}
          >
            📥 Receive File
          </button>
        </div>

        <div className="card">
          <div className="card-title">
            {tab === "send" ? "Create a Room" : "Join a Room"}
          </div>
          {tab === "send" ? <CreateRoom /> : <JoinRoom initialCode={urlRoom || ""} />}
        </div>

        <p style={{ marginTop: 32, fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
          Rooms expire after 24 hours · Files are deleted automatically
        </p>
      </div>
    </>
  );
}
