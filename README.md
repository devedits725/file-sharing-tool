# DropRoom — Room-Based File Sharing

Upload a file → get a 6-character room code → anyone with the code can download it.

---

## Project Structure

```
file-sharing-tool/
├── backend/
│   ├── main.py            ← FastAPI app (all-in-one)
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx        ← React app (all-in-one)
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Run the Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --port 8000
```

API will be live at: http://localhost:8000  
Swagger docs at:     http://localhost:8000/docs

---

## 🖥️ Run the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be live at: http://localhost:5173

---

## API Endpoints

| Method   | Endpoint                       | Description                     |
|----------|--------------------------------|---------------------------------|
| POST     | /rooms/create                  | Upload file → create room       |
| GET      | /rooms/{room_code}             | Get room info & file metadata   |
| GET      | /rooms/{room_code}/download    | Download the file               |
| DELETE   | /rooms/{room_code}             | Delete room & file              |

---

## Features

- 📤 Drag & drop or click-to-upload
- 🏠 Auto-generated 6-char room codes (e.g. XK92PL)
- 📥 Join any room by entering the code
- ⏰ Rooms expire automatically after 24 hours
- 📊 Download count tracking
- 🔗 Shareable link with ?room= query param
- 🗑 Host can delete the room at any time
