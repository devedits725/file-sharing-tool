from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
import uuid, os, random, string, shutil

# ───────────────────────────────────────────
# DATABASE SETUP
# ───────────────────────────────────────────
DATABASE_URL = "sqlite:///./rooms.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ───────────────────────────────────────────
# MODEL
# ───────────────────────────────────────────
class Room(Base):
    __tablename__ = "rooms"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    room_code      = Column(String, unique=True, index=True, nullable=False)
    file_name      = Column(String, nullable=False)
    file_path      = Column(String, nullable=False)
    file_size      = Column(Integer, nullable=False)
    mime_type      = Column(String, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    expires_at     = Column(DateTime, nullable=False)
    download_count = Column(Integer, default=0)
    is_active      = Column(Boolean, default=True)


Base.metadata.create_all(bind=engine)

# ───────────────────────────────────────────
# UPLOAD DIRECTORY
# ───────────────────────────────────────────
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ───────────────────────────────────────────
# APP
# ───────────────────────────────────────────
app = FastAPI(title="File Sharing Rooms API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ───────────────────────────────────────────
# HELPERS
# ───────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_room_code(length: int = 6) -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=length))


def unique_room_code(db) -> str:
    """Keep generating until we get a code not already in the DB."""
    while True:
        code = generate_room_code()
        if not db.query(Room).filter(Room.room_code == code).first():
            return code


def is_expired(room: Room) -> bool:
    return datetime.utcnow() > room.expires_at or not room.is_active


# ───────────────────────────────────────────
# ROUTES
# ───────────────────────────────────────────

@app.post("/rooms/create", summary="Upload a file and create a room")
async def create_room(file: UploadFile = File(...), db=Depends(get_db)):
    """
    Upload a file → generates a unique 6-char room code → stores file on disk.
    Room expires 24 hours after creation.
    """
    code = unique_room_code(db)

    # Save file to disk
    file_id   = str(uuid.uuid4())
    safe_name = file.filename.replace(" ", "_")
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_name}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = os.path.getsize(file_path)

    room = Room(
        id             = file_id,
        room_code      = code,
        file_name      = file.filename,
        file_path      = file_path,
        file_size      = file_size,
        mime_type      = file.content_type or "application/octet-stream",
        expires_at     = datetime.utcnow() + timedelta(hours=24),
        download_count = 0,
        is_active      = True,
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    return {
        "room_code"     : room.room_code,
        "file_name"     : room.file_name,
        "file_size"     : room.file_size,
        "mime_type"     : room.mime_type,
        "created_at"    : room.created_at,
        "expires_at"    : room.expires_at,
        "download_count": room.download_count,
    }


@app.get("/rooms/{room_code}", summary="Get room info by code")
def get_room(room_code: str, db=Depends(get_db)):
    """
    Returns file metadata for the room. Raises 404 if not found, 410 if expired.
    """
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if is_expired(room):
        raise HTTPException(status_code=410, detail="Room has expired")

    return {
        "room_code"     : room.room_code,
        "file_name"     : room.file_name,
        "file_size"     : room.file_size,
        "mime_type"     : room.mime_type,
        "created_at"    : room.created_at,
        "expires_at"    : room.expires_at,
        "download_count": room.download_count,
        "is_active"     : room.is_active,
    }


@app.get("/rooms/{room_code}/download", summary="Download the file from a room")
def download_file(room_code: str, db=Depends(get_db)):
    """
    Streams the file back to the client and increments download count.
    """
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if is_expired(room):
        raise HTTPException(status_code=410, detail="Room has expired")
    if not os.path.exists(room.file_path):
        raise HTTPException(status_code=404, detail="File missing from server")

    room.download_count += 1
    db.commit()

    return FileResponse(
        path       = room.file_path,
        filename   = room.file_name,
        media_type = room.mime_type,
    )


@app.delete("/rooms/{room_code}", summary="Delete a room and its file")
def delete_room(room_code: str, db=Depends(get_db)):
    """
    Deletes the room record and removes the file from disk.
    """
    room = db.query(Room).filter(Room.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Remove file from disk
    if os.path.exists(room.file_path):
        os.remove(room.file_path)

    db.delete(room)
    db.commit()
    return {"message": f"Room {room_code.upper()} deleted successfully"}


# ───────────────────────────────────────────
# RUN:  uvicorn main:app --reload --port 8000
# ───────────────────────────────────────────
