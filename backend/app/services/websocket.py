"""WebSocket manager for real-time progress push."""
import json
import asyncio
from typing import Any


class WSManager:
    """Manages WebSocket connections and broadcasts."""

    def __init__(self):
        self._connections: list[Any] = []

    def connect(self, websocket):
        self._connections.append(websocket)

    def disconnect(self, websocket):
        if websocket in self._connections:
            self._connections.remove(websocket)

    async def broadcast(self, payload: dict):
        """Broadcast a JSON payload to all connected clients."""
        if not self._connections:
            return
        dead = []
        for conn in self._connections:
            try:
                await conn.send_json(payload)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)

    async def push_progress(self, task_id: int, task_type: str, status: str,
                            processed: int = 0, total: int = 0,
                            message: str = "", **extra):
        """Push a progress update to all clients."""
        await self.broadcast({
            "type": "progress",
            "task_id": task_id,
            "task_type": task_type,
            "status": status,
            "processed": processed,
            "total": total,
            "message": message,
            **extra
        })


ws_manager = WSManager()
