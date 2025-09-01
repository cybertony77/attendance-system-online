import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';

const QRScanner = ({ onQRCodeScanned, onError }) => {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const sessionRef = useRef(0); // 🔑 cancels stale callbacks

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);

  const extractStudentId = (qrText) => {
    try {
      const url = new URL(qrText);
      const id = url.searchParams.get('id');
      if (id) return id;
    } catch {}
    if (/^\d+$/.test(qrText)) return qrText;
    return null;
  };

  const startCameraProcess = async () => {
    const mySession = ++sessionRef.current; // start a fresh session
    try {
      if (!videoRef.current) throw new Error('Video element not available');

      // getUserMedia first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      // attach stream
      videoRef.current.srcObject = stream;

      // wait for playback
      await new Promise((resolve, reject) => {
        const video = videoRef.current;
        const onLoaded = () => {
          video.play().then(resolve).catch(reject);
        };
        video.onloadedmetadata = onLoaded;
        video.onerror = reject;
        setTimeout(() => reject(new Error('Video loading timeout')), 5000);
      });

      // create reader
      codeReaderRef.current = new BrowserQRCodeReader();

      // ⚠️ Mark camera started BEFORE kicking off decode to avoid re-entrancy
      setCameraStarted(true);

      // Start decoding (do not await; we manage lifecycle via sessionRef)
      codeReaderRef.current.decodeFromVideoElement(
        videoRef.current,
        (result, err) => {
          // Ignore any callbacks from older/aborted sessions
          if (mySession !== sessionRef.current) return;

          if (result) {
            const text = result.text ?? (result.getText?.() || '');
            const studentId = extractStudentId(text);
            if (studentId) {
              onQRCodeScanned?.(studentId);
              stopCamera(); // stop after first valid scan
            } else {
              setError('Invalid QR code: not a valid student ID');
            }
          }

          // Only log/handle non-NotFound errors
          if (err && err.name !== 'NotFoundException') {
            if (onError) onError(err);
            // Optional: setError(err.message || 'Scanning error');
          }
        }
      );
    } catch (err) {
      if (onError) onError(err);
      console.error('Camera error:', err);
      if (err.message === 'Video element not available') {
        setError('Video element not ready. Please try again.');
      } else if (err.message === 'Video loading timeout') {
        setError('Video failed to load. Please try again.');
      } else if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'NotFoundError') {
        setError('Camera not available. Please check if another app is using the camera.');
      } else if (err.name === 'NotSupportedError') {
        setError('Camera not supported in this browser. Please try a different browser.');
      } else {
        setError('Failed to start camera. Please try again.');
      }
      setIsScanning(false);
      setVideoReady(false);
      setCameraStarted(false);
    }
  };

  const startCamera = () => {
    setError('');
    setIsScanning(true);
    setVideoReady(false);
    setCameraStarted(false);
  };

  const stopCamera = () => {
    // Invalidate any in-flight decode callbacks
    sessionRef.current++;

    try {
      // Stop zxing and release workers
      if (codeReaderRef.current) {
        try { codeReaderRef.current.reset(); } catch {}
        codeReaderRef.current = null;
      }

      // Stop the video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    } catch (err) {
      console.error('Error stopping camera:', err);
    } finally {
      setIsScanning(false);
      setVideoReady(false);
      setCameraStarted(false);
      setError('');
    }
  };

  // Mark video ready once available
  useEffect(() => {
    if (isScanning && videoRef.current && !videoReady) setVideoReady(true);
  }, [isScanning, videoReady]);

  // Only start when scanning is on, video is ready and camera not started
  useEffect(() => {
    if (isScanning && videoReady && videoRef.current && !cameraStarted) {
      startCameraProcess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, videoReady, cameraStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide error after 5s
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', marginBottom: 24 }}>
      {!isScanning ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, background: '#f8f9fa', borderRadius: 12, border: '2px dashed #dee2e6', padding: 20, textAlign: 'center', gap: 16 }}>
          <div style={{ color: '#6c757d', fontSize: '1rem', fontWeight: 500, marginBottom: 8 }}>📱 Choose how to scan QR code</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={startCamera} style={{ padding: '16px 32px', border: 'none', borderRadius: 12, fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'center', background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)', color: 'white', boxShadow: '0 4px 16px rgba(40, 167, 69, 0.3)' }}>
              📷 Open Camera
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 300, height: 300, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '2px solid #e9ecef' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay playsInline muted />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
            <button onClick={stopCamera} style={{ padding: '16px 32px', border: 'none', borderRadius: 12, fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'center', background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)', color: 'white', boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)' }}>
              ❌ Stop Camera
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)', color: 'white', borderRadius: 10, padding: 16, marginTop: 16, textAlign: 'center', fontWeight: 600, boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)' }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default QRScanner;
