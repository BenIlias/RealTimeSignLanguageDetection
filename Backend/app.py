import cv2
from cvzone.HandTrackingModule import HandDetector

def main():
    # ===== 1. Set your image path here =====
    image_path = "right.png"  # <- change this to your image file

    # ===== 2. Read the image =====
    img = cv2.imread(image_path)

    if img is None:
        raise ValueError(f"Could not read image at path: {image_path}")

    # ===== 3. Create hand detector =====
    detector = HandDetector(maxHands=1, detectionCon=0.7)

    # ===== 4. Run detection on the image =====
    # draw=True by default → cvzone will draw landmarks/points/bbox
    hands, img = detector.findHands(img)

    # ===== 5. If a hand is found, inspect info =====
    if hands:
        hand = hands[0]

        # Bounding box
        x, y, w, h = hand['bbox']

        # Hand side: 'Left' or 'Right'
        hand_type = hand['type']

        

    # ===== 6. Show result =====
    cv2.imshow("Hand Detection", img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

