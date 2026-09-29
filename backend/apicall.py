from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from multiplayer import router as multiplayer_router
from trivia import TriviaError, fetch_questions

app = FastAPI()

#cd backend
#uvicorn apicall:app --reload --port 8000

# Allow React (running on port 5173) to send requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


#returns the questions to the frontend, where it can be retrieved with a GET request
#e.g. /api/questions?amount=10&category=9&difficulty=easy&type=multiple
@app.get("/api/questions")
def get_questions(amount: int = 10, category: str = "all", difficulty: str = "all", type: str = "all"):
    try:
        return fetch_questions(amount, category, difficulty, type)
    except TriviaError as e:
        return JSONResponse({"error": str(e)}, status_code=502)


# Used by the hosting service to check the server is up
@app.get("/api/health")
def health():
    return {"ok": True}


app.include_router(multiplayer_router)


# In production the built React app (npm run build) is served by this same server,
# so the whole app runs as one service. Must be mounted last so /api routes win.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "my-react-app" / "dist"
if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
