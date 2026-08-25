"""친구 고양이 실시간 만남용 멀티플레이 서버.

각 접속자의 위치/이름/스킨/발걸음 소리/채팅을 받아서 나머지 접속자에게
그대로 중계(broadcast)한다. 아무것도 DB에 저장하지 않는다 —
접속해 있는 동안만 존재하는 정보라 서버가 재시작되면 다 사라진다.
"""

import asyncio
import json
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

# client_id -> {"ws": WebSocket, "state": dict | None, "sound": str | None}
clients: dict[str, dict] = {}

# 발걸음 소리 하나가 너무 크면 다른 사람들 실시간 위치 동기화까지 같이 버벅이므로
# (base64라 원본 오디오보다 33% 정도 더 큼) 넉넉하게 잡아도 이 정도면 충분함.
MAX_SOUND_BYTES = 400_000
MAX_CHAT_CHARS = 120


@app.get("/")
def health():
    return {"status": "ok", "online": len(clients)}


async def broadcast(sender_id: str, message: dict):
    data = json.dumps(message)  # 받는 사람 수만큼 반복 직렬화하지 않도록 한 번만 만듦
    dead = []

    async def send_to(cid: str, ws: WebSocket):
        try:
            await ws.send_text(data)
        except Exception:
            dead.append(cid)

    await asyncio.gather(*(send_to(cid, info["ws"]) for cid, info in clients.items() if cid != sender_id))
    for cid in dead:
        clients.pop(cid, None)


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = None
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except ValueError:
                continue

            msg_type = msg.get("type")

            if msg_type == "hello":
                client_id = str(msg.get("id") or "")[:64]
                if not client_id:
                    continue
                clients[client_id] = {"ws": websocket, "state": None, "sound": None}
                # 새로 들어온 사람에게 이미 접속해 있던 사람들 정보를 한 번에 보내줌
                for cid, info in clients.items():
                    if cid == client_id:
                        continue
                    if info["state"]:
                        await websocket.send_text(json.dumps({"type": "state", "id": cid, **info["state"]}))
                    if info["sound"]:
                        await websocket.send_text(json.dumps({"type": "sound", "id": cid, "sound": info["sound"]}))

            elif msg_type == "state" and client_id:
                state = {
                    "name": msg.get("name"),
                    "skin": msg.get("skin"),
                    "x": msg.get("x"),
                    "y": msg.get("y"),
                    "facing": msg.get("facing"),
                }
                clients[client_id]["state"] = state
                await broadcast(client_id, {"type": "state", "id": client_id, **state})

            elif msg_type == "sound" and client_id:
                sound = msg.get("sound")
                if sound and len(sound) > MAX_SOUND_BYTES:
                    continue  # 너무 큰 녹음은 조용히 무시 (다른 사람 동기화가 밀리는 걸 방지)
                clients[client_id]["sound"] = sound
                await broadcast(client_id, {"type": "sound", "id": client_id, "sound": sound})

            elif msg_type == "chat" and client_id:
                text = str(msg.get("text") or "")[:MAX_CHAT_CHARS]
                if not text.strip():
                    continue
                await broadcast(client_id, {"type": "chat", "id": client_id, "text": text})

            elif msg_type == "poke" and client_id:
                target = str(msg.get("target") or "")[:64]
                if not target:
                    continue
                await broadcast(client_id, {"type": "poke", "id": client_id, "target": target})

            elif msg_type == "feed" and client_id:
                target = str(msg.get("target") or "")[:64]
                if not target:
                    continue
                await broadcast(client_id, {"type": "feed", "id": client_id, "target": target})

    except WebSocketDisconnect:
        pass
    finally:
        if client_id and client_id in clients:
            clients.pop(client_id, None)
            await broadcast(client_id, {"type": "leave", "id": client_id})


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
