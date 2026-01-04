import React, { useRef, useEffect, useState } from "react";

// ==================== UTILITY FUNCTIONS ====================

const drawRect = (bbox, label, ctx, color = "#00FF00") => {
  const { x, y, w, h } = bbox;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  
  ctx.fillStyle = color;
  ctx.fillRect(x, y - 30, w, 30);
  
  ctx.fillStyle = "#000000";
  ctx.font = "18px Arial";
  ctx.fillText(label, x + 5, y - 10);
};

// ==================== DETECTION PANEL COMPONENT ====================

const DetectionPanel = ({ 
  title, 
  color, 
  isConnected, 
  onConnect, 
  onDisconnect, 
  metrics, 
  canvasRef, 
  videoRef,
  cameraReady 
}) => {
  return (
    <div style={{
      backgroundColor: "#2a2a2a",
      padding: "20px",
      borderRadius: "10px",
      border: `2px solid ${color}`
    }}>
      <h2 style={{ color, marginBottom: "15px" }}>
        {title}
      </h2>
      
      <div style={{ marginBottom: "15px" }}>
        <button
          onClick={isConnected ? onDisconnect : onConnect}
          disabled={!cameraReady}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: isConnected ? "#ff4444" : color,
            color: "#000",
            border: "none",
            borderRadius: "5px",
            cursor: cameraReady ? "pointer" : "not-allowed",
            fontWeight: "bold",
            width: "100%"
          }}
        >
          {isConnected ? "🔴 Disconnect" : "🟢 Connect"}
        </button>
      </div>
      
      <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", marginBottom: "15px" }}>
        {videoRef && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              borderRadius: "10px",
              backgroundColor: "#000"
            }}
          />
        )}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            borderRadius: "10px"
          }}
        />
      </div>
      
      <div style={{
        backgroundColor: "#1a1a1a",
        padding: "10px",
        borderRadius: "5px"
      }}>
        <div style={{ marginBottom: "5px" }}>
          <strong>FPS:</strong> {metrics.fps}
        </div>
        <div style={{ marginBottom: "5px" }}>
          <strong>Latency:</strong> {metrics.latency}ms
        </div>
        <div style={{ marginBottom: "5px" }}>
          <strong>{title === "HTTP Polling" ? "Requests" : "Messages"}:</strong> {metrics.count}
        </div>
        <div>
          <strong>Errors:</strong> {metrics.errors}
        </div>
      </div>
    </div>
  );
};

// ==================== MAIN APP COMPONENT ====================

const App = () => {
  // Shared video
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // HTTP refs
  const httpCanvasRef = useRef(null);
  const httpScreenshotRef = useRef(null);
  const httpIntervalRef = useRef(null);
  const httpInFlight = useRef(false);
  
  // WebSocket refs
  const wsCanvasRef = useRef(null);
  const wsScreenshotRef = useRef(null);
  const wsIntervalRef = useRef(null);
  const wsRef = useRef(null);
  const wsInFlight = useRef(false);
  const wsSendTime = useRef(0);
  
  // States
  const [httpConnected, setHttpConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  
  // Metrics
  const [httpMetrics, setHttpMetrics] = useState({
    fps: 0,
    latency: 0,
    count: 0,
    errors: 0
  });
  
  const [wsMetrics, setWsMetrics] = useState({
    fps: 0,
    latency: 0,
    count: 0,
    errors: 0
  });

  // Initialize camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          videoRef.current.onloadedmetadata = () => {
            setCameraReady(true);
          };
        }
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // HTTP Detection
  const startHttp = () => {
    if (!cameraReady || httpConnected) return;
    setHttpConnected(true);
    
    let lastTime = Date.now();
    
    httpIntervalRef.current = setInterval(async () => {
      if (httpInFlight.current) return;
      
      const video = videoRef.current;
      const canvas = httpScreenshotRef.current;
      const drawCanvas = httpCanvasRef.current;
      
      if (!video || video.readyState !== 4 || !canvas || !drawCanvas) return;
      
      httpInFlight.current = true;
      const startTime = Date.now();
      
      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        drawCanvas.width = video.videoWidth;
        drawCanvas.height = video.videoHeight;
        
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);
        
        const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.8));
        const formData = new FormData();
        formData.append("file", blob, "frame.jpg");
        
        const response = await fetch("http://localhost:8000/detect-hand", {
          method: "POST",
          body: formData,
        });
        
        const data = await response.json();
        const latency = Date.now() - startTime;
        
        const drawCtx = drawCanvas.getContext("2d");
        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        
        if (data.handDetected && data.bbox) {
          drawRect(data.bbox, `HTTP: ${data.handType}`, drawCtx, "#00FF00");
        }
        
        const now = Date.now();
        const fps = Math.round(1000 / (now - lastTime));
        lastTime = now;
        
        setHttpMetrics(prev => ({
          fps: fps,
          latency: latency,
          count: prev.count + 1,
          errors: prev.errors
        }));
        
      } catch (err) {
        console.error("HTTP error:", err);
        setHttpMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
      } finally {
        httpInFlight.current = false;
      }
    }, 150);
  };

  const stopHttp = () => {
    if (httpIntervalRef.current) {
      clearInterval(httpIntervalRef.current);
      httpIntervalRef.current = null;
    }
    setHttpConnected(false);
    httpInFlight.current = false;
    
    if (httpCanvasRef.current) {
      const ctx = httpCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, httpCanvasRef.current.width, httpCanvasRef.current.height);
    }
  };

  // WebSocket Detection
  const startWebSocket = () => {
    if (!cameraReady || wsConnected) return;
    
    const ws = new WebSocket("ws://localhost:8000/ws/detect-hand");
    wsRef.current = ws;
    
    ws.onopen = () => {
      setWsConnected(true);
      
      let lastTime = Date.now();
      
      wsIntervalRef.current = setInterval(async () => {
        if (wsInFlight.current || ws.readyState !== WebSocket.OPEN) return;
        
        const video = videoRef.current;
        const canvas = wsScreenshotRef.current;
        const drawCanvas = wsCanvasRef.current;
        
        if (!video || video.readyState !== 4 || !canvas || !drawCanvas) return;
        
        wsInFlight.current = true;
        const startTime = Date.now();
        wsSendTime.current = startTime;
        
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          drawCanvas.width = video.videoWidth;
          drawCanvas.height = video.videoHeight;
          
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0);
          
          const base64 = canvas.toDataURL("image/jpeg", 0.8);
          ws.send(base64);
          
          const now = Date.now();
          const fps = Math.round(1000 / (now - lastTime));
          lastTime = now;
          
          setWsMetrics(prev => ({
            ...prev,
            fps: fps,
            count: prev.count + 1
          }));
          
        } catch (err) {
          console.error("WS send error:", err);
          setWsMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
          wsInFlight.current = false;
        }
      }, 150);
    };
    
    ws.onmessage = (event) => {
      wsInFlight.current = false;
      const latency = Date.now() - wsSendTime.current;
      
      try {
        const data = JSON.parse(event.data);
        const drawCanvas = wsCanvasRef.current;
        
        if (drawCanvas) {
          const drawCtx = drawCanvas.getContext("2d");
          drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
          
          if (data.handDetected && data.bbox) {
            drawRect(data.bbox, `WS: ${data.handType}`, drawCtx, "#00BFFF");
          }
        }
        
        setWsMetrics(prev => ({ ...prev, latency: latency }));
        
      } catch (err) {
        console.error("WS message error:", err);
      }
    };
    
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setWsMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
    };
    
    ws.onclose = () => {
      setWsConnected(false);
      stopWebSocket();
    };
  };

  const stopWebSocket = () => {
    if (wsIntervalRef.current) {
      clearInterval(wsIntervalRef.current);
      wsIntervalRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setWsConnected(false);
    wsInFlight.current = false;
    
    if (wsCanvasRef.current) {
      const ctx = wsCanvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, wsCanvasRef.current.width, wsCanvasRef.current.height);
    }
  };

  const resetMetrics = () => {
    setHttpMetrics({ fps: 0, latency: 0, count: 0, errors: 0 });
    setWsMetrics({ fps: 0, latency: 0, count: 0, errors: 0 });
  };

  return (
    <div style={{
      backgroundColor: "#1a1a1a",
      minHeight: "100vh",
      padding: "20px",
      color: "#fff"
    }}>
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>
        HTTP vs WebSocket Hand Detection
      </h1>
      
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        maxWidth: "1400px",
        margin: "0 auto"
      }}>
        <DetectionPanel
          title="HTTP Polling"
          color="#00FF00"
          isConnected={httpConnected}
          onConnect={startHttp}
          onDisconnect={stopHttp}
          metrics={httpMetrics}
          canvasRef={httpCanvasRef}
          videoRef={videoRef}
          cameraReady={cameraReady}
        />
        
        <DetectionPanel
          title="WebSocket"
          color="#00BFFF"
          isConnected={wsConnected}
          onConnect={startWebSocket}
          onDisconnect={stopWebSocket}
          metrics={wsMetrics}
          canvasRef={wsCanvasRef}
          videoRef={null}
          cameraReady={cameraReady}
        />
      </div>
      
      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <button
          onClick={resetMetrics}
          style={{
            padding: "10px 30px",
            fontSize: "16px",
            backgroundColor: "#666",
            color: "#fff",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Reset Metrics
        </button>
      </div>
      
      <canvas ref={httpScreenshotRef} style={{ display: "none" }} />
      <canvas ref={wsScreenshotRef} style={{ display: "none" }} />
    </div>
  );
};

export default App;