# hand_detector.py
import cv2
import numpy as np
from cvzone.HandTrackingModule import HandDetector

# Create the detector once (reuse it for every request)
detector = HandDetector(maxHands=1, detectionCon=0.7)

def detect_from_image(img: np.ndarray) -> dict:
    """
    Detect a hand in a BGR image (OpenCV format).

    Returns a dict:
      {
        "handDetected": bool,
        "handType": "Left" | "Right" | None,
        "bbox": {"x": int, "y": int, "w": int, "h": int} | None
      }
    """

    # No drawing here; frontend will draw
    hands, _ = detector.findHands(img, draw=False)

    if not hands:
        return {
            "handDetected": False,
            "handType": None,
            "bbox": None,
        }

    hand = hands[0]

    x, y, w, h = hand["bbox"]        # pixel coordinates
    hand_type = hand["type"]         # "Left" or "Right"

    return {
        "handDetected": True,
        "handType": hand_type,
        "bbox": {
            "x": int(x),
            "y": int(y),
            "w": int(w),
            "h": int(h),
        },
    }
