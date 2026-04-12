"""FastAPI main application."""
import asyncio
import base64
import os
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routes.api import router as api_router
from app.services.websocket import ws_manager
from app.services.runtime_scheduler import runtime_scheduler


def verify_basic_auth(request: Request) -> str:
    """Verify Basic Auth from request headers. Returns username on success."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Basic "):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": 'Basic realm="STRM Generator"'},
        )
    try:
        decoded = base64.b64decode(auth[6:]).decode("utf-8")
        username, password = decoded.split(":", 1)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": 'Basic realm="STRM Generator"'},
        )
    from secrets import compare_digest
    correct_user = os.getenv("STRS_AUTH_USER", "jdyyds")
    correct_pass = os.getenv("STRS_AUTH_PASS", "f15015699065")
    if not (compare_digest(username, correct_user) and compare_digest(password, correct_pass)):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": 'Basic realm="STRM Generator"'},
        )
    return username


app = FastAPI(title='STRM Generator API', version='1.0.0')

# CORS - allow all for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.on_event("startup")
async def on_startup():
    init_db()
    runtime_scheduler.start()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time progress推送."""
    # WebSocket auth: receive headers manually before accept
    headers = dict(websocket.headers)
    auth_header = headers.get("authorization", "")
    if not auth_header.startswith("Basic "):
        await websocket.close(code=4001)
        return
    try:
        decoded = base64.b64decode(auth_header[6:]).decode("utf-8")
        username, password = decoded.split(":", 1)
    except Exception:
        await websocket.close(code=4001)
        return
    from secrets import compare_digest
    correct_user = os.getenv("STRS_AUTH_USER", "jdyyds")
    correct_pass = os.getenv("STRS_AUTH_PASS", "f15015699065")
    if not (compare_digest(username, correct_user) and compare_digest(password, correct_pass)):
        await websocket.close(code=4001)
        return

    await websocket.accept()
    ws_manager.connect(websocket)
    try:
        while True:
            # Keep alive - wait for client messages (ping/pong)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=60)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_json({"type": "heartbeat"})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@app.on_event("shutdown")
async def on_shutdown():
    await runtime_scheduler.stop()


@app.get("/health")
def health():
    return {"status": "ok"}
