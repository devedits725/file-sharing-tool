import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "./supabase";

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

function generateRoomCode(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getFileIcon(mime = "") {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "movie";
  if (mime.startsWith("audio/")) return "audiotrack";
  if (mime.includes("pdf"))      return "description";
  if (mime.includes("zip") || mime.includes("tar") || mime.includes("rar")) return "archive";
  return "draft";
}

// ───────────────────────────────────────────
// API CALLS (Supabase)
// ───────────────────────────────────────────
async function apiCreateRoom(file, onProgress) {
  if (!supabase) throw new Error("Supabase is not configured.");

  let roomCode = "";
  let isUnique = false;
  while (!isUnique) {
    roomCode = generateRoomCode();
    const { data } = await supabase
      .from("rooms")
      .select("room_code")
      .eq("room_code", roomCode)
      .maybeSingle();
    if (!data) isUnique = true;
  }

  const fileExt = file.name.split(".").pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${roomCode}/${fileName}`;

  // REAL-TIME UPLOAD PROGRESS
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("rooms")
    .upload(filePath, file, {
      onUploadProgress: (progress) => {
        const percent = Math.round((progress.loaded / progress.total) * 100);
        onProgress(percent);
      }
    });

  if (uploadError) throw uploadError;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: roomData, error: dbError } = await supabase
    .from("rooms")
    .insert([
      {
        room_code: roomCode,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
        expires_at: expiresAt,
      },
    ])
    .select()
    .single();

  if (dbError) throw dbError;

  onProgress(100);
  return roomData;
}

async function apiGetRoom(code) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code.toUpperCase())
    .maybeSingle();

  if (error || !data) throw new Error("Room not found");

  if (new Date(data.expires_at) < new Date() || !data.is_active) {
    throw new Error("This room has expired.");
  }

  return data;
}

async function apiDeleteRoom(code) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: room } = await supabase
    .from("rooms")
    .select("file_path")
    .eq("room_code", code.toUpperCase())
    .maybeSingle();

  if (room) {
    await supabase.storage.from("rooms").remove([room.file_path]);
  }

  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("room_code", code.toUpperCase());

  if (error) throw error;
  return { message: "Room deleted" };
}

// ───────────────────────────────────────────
// COMPONENT: RoomCodeDisplay
// ───────────────────────────────────────────
function RoomCodeDisplay({ code }) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-2 md:gap-3">
        {code.split("").map((ch, i) => (
          <div key={i} className="flex items-center gap-2 md:gap-3">
             <div className="w-10 h-14 md:w-16 md:h-24 bg-surface-container border border-outline-variant/20 rounded-lg flex items-center justify-center text-2xl md:text-5xl font-mono font-bold text-primary shadow-[0_10px_30px_rgba(0,0,0,0.3)] border-b-primary/40">
              {ch}
            </div>
            {i < code.length - 1 && (
              <div className="text-on-surface-variant font-mono text-xl md:text-3xl">-</div>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-4">
        <p className="text-on-surface-variant text-sm font-label flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">info</span>
          Share this code or link to allow someone to pull your loop.
        </p>
        <div className="flex gap-4">
          <button
            onClick={copyCode}
            className="text-primary hover:text-secondary transition-colors font-mono text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
            {copied ? "Copied!" : "Copy Code"}
          </button>
          <button
            onClick={copyLink}
            className="text-primary hover:text-secondary transition-colors font-mono text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">link</span>
            Copy Link
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// COMPONENT: CreateRoom
// ───────────────────────────────────────────
function CreateRoom({ initialCode }) {
  const [file, setFile]         = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    if (initialCode) {
      const managed = JSON.parse(localStorage.getItem("filoop_managed") || "{}");
      if (managed[initialCode]) {
        setResult(managed[initialCode]);
      }
    }
  }, [initialCode]);

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
      // PERSIST HOST STATE
      const managed = JSON.parse(localStorage.getItem("filoop_managed") || "{}");
      managed[data.room_code] = data;
      localStorage.setItem("filoop_managed", JSON.stringify(managed));
      window.history.pushState({}, "", `/${data.room_code}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!result) return;
    const codeToDelete = result.room_code;
    try {
      await apiDeleteRoom(codeToDelete);
      const managed = JSON.parse(localStorage.getItem("filoop_managed") || "{}");
      delete managed[codeToDelete];
      localStorage.setItem("filoop_managed", JSON.stringify(managed));
      setResult(null);
      setFile(null);
      setProgress(0);
      window.history.pushState({}, "", "/");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="w-full flex flex-col items-center space-y-12 relative z-10">
      {!result ? (
        <>
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tighter text-on-surface">
              Drop it. Loop it. <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Done.</span>
            </h1>
            <p className="text-on-surface-variant font-body text-lg max-w-lg mx-auto">
              Ultra-fast, ephemeral file sharing. No accounts. No logs. Just flow.
            </p>
          </div>

          <div
            className={`w-full aspect-[16/9] md:aspect-[21/9] flex items-center justify-center p-1 rounded-xl group cursor-pointer transition-all duration-500 ${dragOver ? 'scale-[1.02]' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <div className="w-full h-full dashed-portal rounded-xl flex flex-col items-center justify-center gap-4 bg-surface-container-low/40 backdrop-blur-md hover:bg-surface-container-high/60 transition-all duration-500 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="flex flex-col items-center gap-4 relative z-10">
                <div className="w-16 h-16 rounded-full bg-surface-container-highest flex items-center justify-center text-primary shadow-[0_0_20px_rgba(0,245,196,0.2)]">
                  <span className="material-symbols-outlined text-4xl">cloud_upload</span>
                </div>
                <p className="text-xl font-headline font-medium text-on-surface group-hover:text-primary transition-colors">
                  {file ? file.name : "Drag and drop your files here"}
                </p>
                <p className="text-sm font-mono text-on-surface-variant uppercase tracking-widest">
                  {file ? formatBytes(file.size) : "Max 2GB per loop"}
                </p>
              </div>
            </div>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {uploading && (
            <div className="w-full max-w-md space-y-2">
              <div className="flex justify-between text-xs font-mono text-on-surface-variant uppercase tracking-widest">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1 w-full bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-error-container/20 border border-error/20 p-4 rounded-lg text-error text-sm flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          <button
            className="bg-gradient-to-r from-primary to-secondary text-[#004535] px-12 py-5 rounded-full text-xl font-headline font-bold shadow-[0_10px_40px_rgba(0,245,196,0.3)] hover:shadow-[0_15px_50px_rgba(0,245,196,0.5)] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? "Creating Loop..." : "Create Loop"}
          </button>
        </>
      ) : (
        <>
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-on-surface">
              Loop <span className="text-primary">Ready</span>
            </h1>
            <p className="text-on-surface-variant font-body text-lg">
              Anyone with this code can download your file.
            </p>
          </div>

          <RoomCodeDisplay code={result.room_code} />

          <div className="w-full max-w-xl bg-surface-container/40 backdrop-blur-sm p-6 rounded-lg border border-outline-variant/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">{getFileIcon(result.mime_type)}</span>
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-on-surface font-medium truncate">{result.file_name}</p>
              <p className="text-on-surface-variant text-xs font-mono">{formatBytes(result.file_size)} • {timeLeft(result.expires_at)}</p>
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant text-xs font-mono">
              <span className="material-symbols-outlined text-sm">download</span>
              {result.download_count}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
            <button
              className="bg-surface-container text-on-surface px-8 py-4 rounded-full font-headline font-bold hover:bg-surface-container-high transition-all active:scale-95"
              onClick={() => { setFile(null); setResult(null); }}
            >
              New Loop
            </button>
            <button
              className="bg-error-container/20 text-error px-8 py-4 rounded-full font-headline font-bold hover:bg-error-container/30 transition-all active:scale-95"
              onClick={handleDelete}
            >
              Destroy Loop
            </button>
          </div>
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

  const handleJoin = useCallback(async (joinCode) => {
    const cleanCode = (joinCode || code).trim().toUpperCase();
    if (cleanCode.length < 6) return;
    setLoading(true);
    setError("");
    setRoom(null);
    try {
      const data = await apiGetRoom(cleanCode);
      setRoom(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (initialCode && initialCode.length === 6) {
      handleJoin(initialCode);
    }
  }, [initialCode, handleJoin]);

  const handleDownload = async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.storage
        .from("rooms")
        .createSignedUrl(room.file_path, 60);

      if (error) throw error;

      // IOS COMPATIBLE DOWNLOAD
      window.location.href = data.signedUrl;

      const { data: updatedRoom } = await supabase
        .from("rooms")
        .update({ download_count: room.download_count + 1 })
        .eq("id", room.id)
        .select()
        .single();

      if (updatedRoom) setRoom(updatedRoom);
    } catch (e) {
      setError("Download failed: " + e.message);
    }
  };

  return (
    <div className="w-full flex flex-col items-center space-y-12 relative z-10">
      {!room ? (
        <>
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tighter text-on-surface">
              Enter the <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Loop.</span>
            </h1>
            <p className="text-on-surface-variant font-body text-lg max-w-lg mx-auto">
              Ready to receive? Input the 6-character code below.
            </p>
          </div>

          <div className="w-full max-w-md">
            <input
              type="text"
              maxLength={6}
              placeholder="E.G. XK92PL"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="w-full bg-surface-container border border-outline-variant/20 rounded-2xl p-8 text-center text-4xl md:text-5xl font-mono font-bold text-primary tracking-[0.5em] focus:border-primary/40 focus:ring-1 focus:ring-primary/40 outline-none transition-all placeholder:text-on-surface-variant/20 placeholder:tracking-normal"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-error-container/20 border border-error/20 p-4 rounded-lg text-error text-sm flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}

          <button
            className="bg-gradient-to-r from-primary to-secondary text-[#004535] px-12 py-5 rounded-full text-xl font-headline font-bold shadow-[0_10px_40px_rgba(0,245,196,0.3)] hover:shadow-[0_15px_50px_rgba(0,245,196,0.5)] active:scale-95 transition-all duration-300 disabled:opacity-50"
            disabled={code.length < 6 || loading}
            onClick={() => handleJoin()}
          >
            {loading ? "Joining Loop..." : "Join Loop"}
          </button>
        </>
      ) : (
        <>
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-on-surface">
              File <span className="text-primary">Located</span>
            </h1>
            <p className="text-on-surface-variant font-body text-lg">
              This loop will vanish in {timeLeft(room.expires_at)}.
            </p>
          </div>

          <div className="w-full max-w-xl bg-surface-container-high p-8 rounded-2xl border border-primary/20 shadow-[0_20px_40px_rgba(0,245,196,0.1)] flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-5xl">{getFileIcon(room.mime_type)}</span>
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-headline font-bold text-on-surface">{room.file_name}</h2>
              <p className="text-on-surface-variant font-mono text-sm uppercase tracking-widest">{formatBytes(room.file_size)} • {room.mime_type.split('/')[1] || 'FILE'}</p>
            </div>
            <button
              className="w-full bg-primary text-[#004535] py-5 rounded-xl text-xl font-headline font-bold shadow-[0_10px_30px_rgba(0,245,196,0.2)] hover:shadow-[0_15px_40px_rgba(0,245,196,0.4)] transition-all active:scale-[0.98]"
              onClick={handleDownload}
            >
              DOWNLOAD
            </button>
            <div className="flex items-center gap-4 text-on-surface-variant text-xs font-mono uppercase tracking-tighter">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">download</span>
                {room.download_count} Downloads
              </span>
              <span className="w-1 h-1 bg-outline-variant rounded-full"></span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                Expires in {timeLeft(room.expires_at)}
              </span>
            </div>
          </div>

          <button
            className="text-on-surface-variant hover:text-primary transition-colors font-headline font-bold"
            onClick={() => { setRoom(null); setCode(""); }}
          >
            ← Back to Join
          </button>
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
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // AUTO-PARSE ROOM FROM PATH OR SEARCH
  const urlParams = new URLSearchParams(window.location.search);
  const searchRoom = urlParams.get("room");
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const pathRoom = pathParts.length === 1 && pathParts[0].length === 6 ? pathParts[0] : null;
  const initialRoomCode = pathRoom || searchRoom || "";

  useEffect(() => {
    if (initialRoomCode && tab !== "receive") {
      setTab("receive");
    }
  }, [initialRoomCode]);

  useEffect(() => {
    if (supabase) setSupabaseReady(true);
    setIsChecking(false);
  }, []);

  if (isChecking) return null;

  if (!supabaseReady && !window.BYPASS_CONFIG) {
    return (
      <div className="min-h-screen bg-surface-dim text-on-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-container p-8 rounded-2xl border border-error/20 text-center space-y-6">
          <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-4xl">warning</span>
          </div>
          <h2 className="text-2xl font-headline font-bold">Configuration Required</h2>
          <p className="text-on-surface-variant">
            Please set <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> to start using Filoop.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-dim text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col overflow-x-hidden">
      <header className="fixed top-0 w-full flex justify-between items-center px-6 py-4 bg-[#060e1b]/80 backdrop-blur-xl z-50 border-b border-[#404857]/10 shadow-[0_20px_40px_rgba(0,245,196,0.08)]">
        <div className="flex items-center gap-8">
          <button onClick={() => setTab('send')} className="text-2xl font-bold bg-gradient-to-r from-[#00f5c4] to-[#a3ff47] bg-clip-text text-transparent font-headline tracking-tight">Filoop</button>
          <nav className="flex gap-6 items-center">
            <button
              className={`font-headline tracking-tight transition-all duration-300 pb-1 ${tab === 'send' ? 'text-primary border-b-2 border-primary' : 'text-[#a3abbd] hover:text-[#e0e8fc]'}`}
              onClick={() => setTab('send')}
            >
              Send
            </button>
            <button
              className={`font-headline tracking-tight transition-all duration-300 pb-1 ${tab === 'receive' ? 'text-primary border-b-2 border-primary' : 'text-[#a3abbd] hover:text-[#e0e8fc]'}`}
              onClick={() => setTab('receive')}
            >
              Receive
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-[#1f2c41]/50 transition-all duration-300 active:scale-95 text-[#a3abbd]">
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center relative px-6 pt-32 pb-12">
        <div className="absolute inset-0 kinetic-grid pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] aspect-square radial-glow pointer-events-none"></div>

        {tab === "send" ? <CreateRoom /> : <JoinRoom initialCode={initialRoomCode} />}
      </main>

      <footer className="w-full flex flex-col items-center gap-4 px-6 py-8 bg-[#060e1b] border-t border-[#404857]/10 z-10">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd]">Files loop for 24 hours then vanish · No account needed</p>
        <div className="flex gap-6">
          <a className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Privacy</a>
          <a className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Terms</a>
          <a className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Support</a>
        </div>
      </footer>
    </div>
  );
}
