# main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import base64
from hand_detector import detect_from_image

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/detect-hand")
async def detect_hand(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")

    result = detect_from_image(img)
    return result



@app.websocket("/ws/detect-hand")
async def websocket_detect_hand(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            # Receive base64 image from frontend
            data = await websocket.receive_text()
            
            # Convert base64 -> bytes -> numpy -> OpenCV image
            img_data = base64.b64decode(data.split(',')[1])  # Remove "data:image/jpeg;base64," prefix
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                await websocket.send_json({
                    "handDetected": False,
                    "handType": None,
                    "bbox": None,
                    "error": "Invalid image"
                })
                continue
            
            # Same detection logic
            result = detect_from_image(img)
            
            # Send result back
            await websocket.send_json(result)
            
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()
