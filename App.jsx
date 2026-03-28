import { useState, useRef, useCallback, useEffect } from "react";
import { QRCodeSVG } from 'qrcode.react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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
async function apiUploadToFileLoop(file, onProgress, existingCode = null) {
  if (!supabase) throw new Error("Supabase is not configured.");

  // Initialize progress state
  const progressState = {
    stage: 'initializing',
    percentage: 0,
    startTime: Date.now()
  };

  const updateProgress = (stage, percentage) => {
    progressState.stage = stage;
    progressState.percentage = percentage;
    console.log(`[${stage}] ${percentage}%`);
    onProgress(percentage, stage);
  };

  updateProgress('initializing', 0);
  
  let roomCode = existingCode;
  let roomId;
  let expiresAt;

  // Room creation/retrieval stage (0-10%)
  updateProgress('creating_room', 5);
  
  if (!roomCode) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      roomCode = generateRoomCode();
      const { data } = await supabase
        .from("rooms")
        .select("room_code")
        .eq("room_code", roomCode)
        .maybeSingle();
      if (!data) isUnique = true;
      attempts++;
    }

    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: newRoom, error: roomError } = await supabase
      .from("rooms")
      .insert([{ room_code: roomCode, expires_at: expiresAt }])
      .select()
      .single();

    if (roomError) throw roomError;
    roomId = newRoom.id;
  } else {
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, expires_at")
      .eq("room_code", roomCode.toUpperCase())
      .single();
    if (roomError) throw roomError;
    roomId = room.id;
    expiresAt = room.expires_at;
  }

  updateProgress('preparing_upload', 10);

  // File upload stage (10-85%)
  const filePath = `${roomCode}/${file.name}`;
  
  return new Promise((resolve, reject) => {
    updateProgress('preparing_upload', 10);
    
    let uploadProgress = 0;
    let progressInterval;
    
    // Fallback progress simulation in case Supabase callback doesn't work
    const startFallbackProgress = () => {
      progressInterval = setInterval(() => {
        if (uploadProgress < 75) {
          uploadProgress += Math.random() * 3 + 1; // Random increments
          uploadProgress = Math.min(75, uploadProgress);
          updateProgress('uploading', 10 + uploadProgress);
        }
      }, 200);
    };
    
    const uploadTask = supabase.storage
      .from("rooms")
      .upload(filePath, file, {
        onUploadProgress: (progress) => {
          console.log("Supabase progress callback:", progress);
          
          if (!progress.total || progress.loaded === undefined) {
            console.log("No progress data from Supabase, using fallback");
            if (!progressInterval) startFallbackProgress();
            return;
          }
          
          // Clear fallback if we get real progress
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
          
          // Calculate upload percentage (15-85% range)
          const uploadPercentage = (progress.loaded / progress.total) * 100;
          const scaledPercentage = 15 + (uploadPercentage * 0.7); // Scale to 15-85%
          const clampedPercentage = Math.max(15, Math.min(85, scaledPercentage));
          
          updateProgress('uploading', Math.round(clampedPercentage));
          uploadProgress = clampedPercentage - 15;
        },
        upsert: true
      });

    // Start fallback after 500ms if no callback
    setTimeout(() => {
      if (!progressInterval) {
        console.log("Starting fallback progress");
        startFallbackProgress();
      }
    }, 500);

    uploadTask.then(({ data, error }) => {
      if (progressInterval) clearInterval(progressInterval);
      
      if (error) {
        reject(error);
        return;
      }
      
      // Database save stage (85-95%)
      updateProgress('saving_metadata', 85);
      
      supabase
        .from("files")
        .insert([
          {
            room_id: roomId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type || "application/octet-stream",
          },
        ])
        .select()
        .single()
        .then(({ data: fileData, error: dbError }) => {
          if (dbError) {
            reject(dbError);
            return;
          }
          
          // Finalization stage (95-100%)
          updateProgress('finalizing', 95);
          
          // Simulate final processing
          setTimeout(() => {
            updateProgress('complete', 100);
            resolve({ room_code: roomCode, expires_at: expiresAt, ...fileData });
          }, 500);
        })
        .catch(reject);
    }).catch((error) => {
      if (progressInterval) clearInterval(progressInterval);
      reject(error);
    });
  });
}

async function apiGetRoom(code) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", code.toUpperCase())
    .maybeSingle();

  if (roomError || !room) throw new Error("Room not found");

  if (new Date(room.expires_at) < new Date() || !room.is_active) {
    throw new Error("This room has expired.");
  }

  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("*")
    .eq("room_id", room.id);

  if (filesError) throw filesError;

  // Attach room info to each file for component compatibility
  return files.map(f => ({
    ...f,
    room_code: room.room_code,
    expires_at: room.expires_at
  }));
}

async function apiDeleteRoom(code) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("room_code", code.toUpperCase())
    .maybeSingle();

  if (room) {
    const { data: files } = await supabase
      .from("files")
      .select("file_path")
      .eq("room_id", room.id);

    if (files && files.length > 0) {
      const paths = files.map(f => f.file_path);
      await supabase.storage.from("rooms").remove(paths);
    }

    const { error } = await supabase
      .from("rooms")
      .delete()
      .eq("id", room.id);

    if (error) throw error;
  }

  return { message: "Room deleted" };
}

// ───────────────────────────────────────────
// COMPONENT: ProgressBar
// ───────────────────────────────────────────
function ProgressBar({ progress, stage }) {
  const getStageText = (stage, percentage) => {
    if (percentage === 100) return "Complete!";
    
    switch (stage) {
      case 'initializing': return 'Initializing...';
      case 'creating_room': return 'Creating room...';
      case 'preparing_upload': return 'Preparing upload...';
      case 'uploading': return 'Uploading...';
      case 'saving_metadata': return 'Saving to database...';
      case 'finalizing': return 'Finalizing...';
      case 'complete': return 'Complete!';
      default: return 'Processing...';
    }
  };

  return (
    <div className="w-full max-w-md space-y-2">
      <div className="flex justify-between text-xs font-mono text-on-surface-variant uppercase tracking-widest">
        <span>{getStageText(stage, progress)}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden shadow-inner">
        <div 
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// COMPONENT: RoomCodeDisplay
// ───────────────────────────────────────────
function RoomCodeDisplay({ code }) {
  const [copied, setCopied] = useState(false);
  const roomUrl = `${window.location.origin}/${code}`;

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(roomUrl);
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
      <div className="flex flex-col items-center gap-6">
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

        <div className="flex flex-col items-center gap-3">
          <p className="text-on-surface-variant font-mono text-[10px] uppercase tracking-widest opacity-70">
            Scan to receive
          </p>
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
            <QRCodeSVG
              value={roomUrl}
              size={160}
              bgColor="transparent"
              fgColor="#00f5c4"
              level="H"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// COMPONENT: FileLoopDashboard
// ───────────────────────────────────────────
function FileLoopDashboard({ roomCode, files, onRefresh, onReset }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ percentage: 0, stage: 'initializing' });
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleFileUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress({ percentage: 0, stage: 'initializing' });
    
    try {
      await apiUploadToFileLoop(file, (percentage, stage) => {
        setProgress({ percentage, stage });
      }, roomCode);
      
      await new Promise(res => setTimeout(res, 800));
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.storage
        .from("rooms")
        .createSignedUrl(file.file_path, 60);

      if (error) throw error;
      window.location.href = data.signedUrl;

      await supabase
        .from("files")
        .update({ download_count: (file.download_count || 0) + 1 })
        .eq("id", file.id);

      onRefresh();
    } catch (e) {
      setError("Download failed: " + e.message);
    }
  };

  const handleDeleteLoop = async () => {
    try {
      await apiDeleteRoom(roomCode);
      const managed = JSON.parse(localStorage.getItem("filoop_managed") || "{}");
      delete managed[roomCode];
      localStorage.setItem("filoop_managed", JSON.stringify(managed));
      onReset();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="w-full flex flex-col items-center space-y-12 relative z-10 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-on-surface">
          Loop <span className="text-primary">Active</span>
        </h1>
        <p className="text-on-surface-variant font-body text-lg">
          Anyone with this code can see and add files to the loop.
        </p>
      </div>

      <RoomCodeDisplay code={roomCode} />

      <div className="w-full max-w-2xl space-y-4">
        {files.map((file, i) => (
          <div key={file.id} className="w-full bg-surface-container/40 backdrop-blur-sm p-5 rounded-xl border border-outline-variant/10 flex items-center gap-4 group hover:bg-surface-container-high/60 transition-all duration-300">
            <div className="w-12 h-12 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined">{getFileIcon(file.mime_type)}</span>
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-on-surface font-medium truncate">{file.file_name}</p>
              <p className="text-on-surface-variant text-xs font-mono">{formatBytes(file.file_size)} • {timeLeft(file.expires_at)}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end text-[10px] font-mono text-on-surface-variant uppercase tracking-tighter">
                <span>{file.download_count} pulls</span>
              </div>
              <button
                onClick={() => handleDownload(file)}
                className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-[#004535] transition-all"
              >
                <span className="material-symbols-outlined text-xl">download</span>
              </button>
            </div>
          </div>
        ))}

        {/* IN-DASHBOARD UPLOAD ZONE */}
        <div
          className={`w-full py-8 dashed-portal rounded-xl flex flex-col items-center justify-center gap-3 bg-surface-container-low/20 backdrop-blur-md hover:bg-surface-container-high/40 transition-all cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files[0]); }}
          onClick={() => inputRef.current?.click()}
        >
          <span className="material-symbols-outlined text-primary text-3xl">add_circle</span>
          <p className="text-sm font-headline font-medium text-on-surface-variant">Add another file to this loop</p>
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => handleFileUpload(e.target.files[0])} />
        </div>
      </div>

      {uploading && (
        <ProgressBar progress={progress.percentage} stage={progress.stage} />
      )}

      {error && (
        <div className="bg-error-container/20 border border-error/20 p-4 rounded-lg text-error text-sm flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
        <button
          className="bg-surface-container text-on-surface px-8 py-4 rounded-full font-headline font-bold hover:bg-surface-container-high transition-all active:scale-95"
          onClick={() => { window.history.pushState({}, "", "/"); onReset(); }}
        >
          New Loop
        </button>
        <button
          className="bg-error-container/20 text-error px-8 py-4 rounded-full font-headline font-bold hover:bg-error-container/30 transition-all active:scale-95"
          onClick={handleDeleteLoop}
        >
          Destroy Loop
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────
// COMPONENT: CreateRoom
// ───────────────────────────────────────────
function CreateRoom({ initialCode }) {
  const [file, setFile]         = useState(null);
  const [progress, setProgress] = useState({ percentage: 0, stage: 'initializing' });
  const [uploading, setUploading] = useState(false);
  const [files, setFiles]       = useState([]);
  const [error, setError]       = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const refreshRoom = async (code) => {
    try {
      const data = await apiGetRoom(code);
      setFiles(data);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (initialCode) {
      const managed = JSON.parse(localStorage.getItem("filoop_managed") || "{}");
      if (managed[initialCode]) {
        refreshRoom(initialCode);
      }
    }
  }, [initialCode]);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setFiles([]);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    setProgress({ percentage: 0, stage: 'initializing' });
    
    try {
      const data = await apiUploadToFileLoop(file, (percentage, stage) => {
        setProgress({ percentage, stage });
      });
      
      await new Promise(res => setTimeout(res, 800));
      
      // PERSIST HOST STATE
      const managed = JSON.parse(localStorage.getItem("filoop_managed") || "{}");
      managed[data.room_code] = data;
      localStorage.setItem("filoop_managed", JSON.stringify(managed));
      window.history.pushState({}, "", `/${data.room_code}`);
      refreshRoom(data.room_code);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (files.length > 0) {
    return <FileLoopDashboard
      roomCode={files[0].room_code}
      files={files}
      onRefresh={() => refreshRoom(files[0].room_code)}
      onReset={() => { setFiles([]); setFile(null); }}
    />;
  }

  return (
    <div className="w-full flex flex-col items-center space-y-12 relative z-10">
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
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
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
        <input ref={inputRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
      </div>

      {uploading && (
        <ProgressBar progress={progress.percentage} stage={progress.stage} />
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
    </div>
  );
}

// ───────────────────────────────────────────
// COMPONENT: JoinRoom
// ───────────────────────────────────────────
function JoinRoom({ initialCode = "" }) {
  const [code, setCode]       = useState(initialCode);
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [mode, setMode]       = useState("type"); // 'type' | 'scan'

  const handleJoin = useCallback(async (joinCode) => {
    const cleanCode = (joinCode || code).trim().toUpperCase();
    if (cleanCode.length < 6) return;
    setLoading(true);
    setError("");
    setFiles([]);
    try {
      const data = await apiGetRoom(cleanCode);
      setFiles(data);
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

  useEffect(() => {
    let scanner = null;
    let isStopping = false;

    const startScanner = async () => {
      try {
        scanner = new Html5Qrcode("reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        const onScanSuccess = async (decodedText) => {
          if (isStopping) return;
          try {
            const url = new URL(decodedText);
            const path = url.pathname.split("/").filter(Boolean);
            const scannedCode = path[0]?.toUpperCase();

            if (scannedCode && scannedCode.length === 6 && /^[A-Z0-9]+$/.test(scannedCode)) {
              isStopping = true;
              await scanner.stop();
              handleJoin(scannedCode);
            }
          } catch (e) {
            const parts = decodedText.split("/").filter(Boolean);
            const lastPart = parts[parts.length - 1]?.toUpperCase();
            if (lastPart && lastPart.length === 6 && /^[A-Z0-9]+$/.test(lastPart)) {
              isStopping = true;
              await scanner.stop();
              handleJoin(lastPart);
            }
          }
        };

        await scanner.start({ facingMode: "environment" }, config, onScanSuccess);
      } catch (err) {
        console.error("Camera error:", err);
        setError("Camera access denied — use the code instead");
      }
    };

    if (mode === 'scan') {
      startScanner();
    }

    return () => {
      if (scanner && !isStopping) {
        try {
          if (scanner.isScanning) {
            scanner.stop().catch(() => {});
          }
        } catch (e) {
          // Ignore scanner stop errors during unmount/mode change
        }
      }
    };
  }, [mode, handleJoin]);

  if (files.length > 0) {
    return <FileLoopDashboard
      roomCode={files[0].room_code}
      files={files}
      onRefresh={() => handleJoin(files[0].room_code)}
      onReset={() => { setFiles([]); setCode(""); }}
    />;
  }

  return (
    <div className="w-full flex flex-col items-center space-y-12 relative z-10">
      <div className="text-center space-y-4">
        <h1 className="text-5xl md:text-7xl font-headline font-bold tracking-tighter text-on-surface">
          Enter the <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Loop.</span>
        </h1>
        <p className="text-on-surface-variant font-body text-lg max-w-lg mx-auto">
          Ready to receive? {mode === 'type' ? 'Input the 6-character code below.' : 'Scan the QR code to pull the loop.'}
        </p>
      </div>

      {/* PILL TOGGLE */}
      <div className="bg-surface-container/60 p-1 rounded-full flex gap-1 z-10 backdrop-blur-md border border-outline-variant/10">
        <button
          onClick={() => setMode('type')}
          className={`px-6 py-2 rounded-full font-headline text-sm transition-all duration-300 ${mode === 'type' ? 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,245,196,0.1)]' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          Type Code
        </button>
        <button
          onClick={() => setMode('scan')}
          className={`px-6 py-2 rounded-full font-headline text-sm transition-all duration-300 ${mode === 'scan' ? 'bg-primary/10 text-primary shadow-[0_0_15px_rgba(0,245,196,0.1)]' : 'text-on-surface-variant hover:text-on-surface'}`}
        >
          Scan QR Code
        </button>
      </div>

      {mode === 'type' ? (
        <>
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
        <div className="w-full max-w-md flex flex-col items-center gap-6">
          <div id="reader" className="w-full aspect-square rounded-2xl overflow-hidden border border-outline-variant/20 bg-black/20 backdrop-blur-sm"></div>

          <p className="text-on-surface-variant font-mono text-[10px] uppercase tracking-widest opacity-70">
            Point camera at a Filoop QR code
          </p>

          {error && (
            <div className="bg-error-container/20 border border-error/20 p-4 rounded-lg text-error text-sm flex items-center gap-3">
              <span className="material-symbols-outlined">error</span>
              {error}
            </div>
          )}
        </div>
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
    if (initialRoomCode) {
      const managed = JSON.parse(localStorage.getItem("filoop_managed") || "{}");
      if (managed[initialRoomCode]) {
        setTab("send");
      } else {
        setTab("receive");
      }
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
      </header>

      <main className="flex-grow flex flex-col items-center justify-center relative px-6 pt-32 pb-12">
        <div className="absolute inset-0 kinetic-grid pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] aspect-square radial-glow pointer-events-none"></div>

        {tab === "send" ? <CreateRoom initialCode={initialRoomCode} /> : <JoinRoom initialCode={initialRoomCode} />}
      </main>

      <footer className="w-full flex flex-col items-center gap-4 px-6 py-8 bg-[#060e1b] border-t border-[#404857]/10 z-10">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd]">made with ❤️ by Dev Raheja</p>
        <div className="flex gap-6">
          <a className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Privacy</a>
          <a className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Terms</a>
          <a className="font-mono text-[10px] uppercase tracking-widest text-[#a3abbd] hover:text-primary transition-colors opacity-80 hover:opacity-100" href="#">Support</a>
        </div>
      </footer>
    </div>
  );
}
