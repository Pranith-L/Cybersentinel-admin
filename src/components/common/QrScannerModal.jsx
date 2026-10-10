import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from './Modal';
import { Camera, Search, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { extractQrToken, extractTeamQrToken } from '../../utils/helpers';
import './QrScannerModal.css';

export function QrScannerModal({
  isOpen,
  onClose,
  onScan,
  onScanSuccess,
  title = 'Scan QR Code',
  placeholder = 'Enter Registration ID or Token',
  mode = 'any', // 'participant' | 'team' | 'any'
}) {
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanDetected, setScanDetected] = useState(false);
  const [capturedCode, setCapturedCode] = useState('');
  const scannerRef = useRef(null);
  const isProcessingRef = useRef(false);

  // Store callbacks in refs so the effect doesn't re-run when they change
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanRef = useRef(onScan);
  const readerId = 'html5-qr-reader-container';

  // Keep refs up to date without triggering effect restarts
  useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const resumeScanning = () => {
    setScanDetected(false);
    setCapturedCode('');
    isProcessingRef.current = false;
    try {
      if (scannerRef.current) {
        scannerRef.current.resume();
      }
    } catch (_) {}
  };

  useEffect(() => {
    let html5QrCode = null;

    if (isOpen) {
      setErrorMsg('');
      setScanDetected(false);
      setCapturedCode('');
      setIsScanning(false);
      isProcessingRef.current = false;

      const startScanner = async () => {
        try {
          await new Promise((r) => setTimeout(r, 300));
          const container = document.getElementById(readerId);
          if (!container) return;

          html5QrCode = new Html5Qrcode(readerId);
          scannerRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: 'environment' },
            {
              fps: 15,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              if (isProcessingRef.current) return;

              let token = '';
              if (mode === 'team') {
                token = extractTeamQrToken(decodedText) || extractQrToken(decodedText) || decodedText;
              } else if (mode === 'participant') {
                token = extractQrToken(decodedText) || decodedText;
              } else {
                // Any mode: check team first if json or prefix, else standard qr token
                token = extractTeamQrToken(decodedText) || extractQrToken(decodedText) || decodedText;
              }

              if (token) {
                // Google Pay style single detection: lock immediately
                isProcessingRef.current = true;
                setScanDetected(true);
                setCapturedCode(token);

                // Pause the camera video/decoding immediately to avoid repeated toasts/calls
                try {
                  if (html5QrCode && html5QrCode.isScanning) {
                    html5QrCode.pause(true);
                  }
                } catch (_) {}

                // Haptic feedback if available
                try {
                  if (typeof navigator !== 'undefined' && navigator.vibrate) {
                    navigator.vibrate(100);
                  }
                } catch (_) {}

                // Dispatch single callback cleanly
                setTimeout(() => {
                  if (onScanSuccessRef.current) onScanSuccessRef.current(token, decodedText);
                  if (onScanRef.current) onScanRef.current({ qrToken: token, rawText: decodedText });
                }, 150);
              }
            },
            () => {}
          );
          setIsScanning(true);
        } catch (err) {
          console.warn('Camera scan start failed:', err);
          setErrorMsg(
            'Camera permission required. Please allow camera access in your browser or enter the Registration ID manually below.'
          );
          setIsScanning(false);
        }
      };

      startScanner();
    }

    return () => {
      isProcessingRef.current = false;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try { scannerRef.current?.clear(); } catch (_) {}
            scannerRef.current = null;
          });
      }
    };
  // Only restart the scanner when isOpen changes — not on callback changes
  }, [isOpen, mode]);

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const token = mode === 'team'
      ? extractTeamQrToken(manualCode.trim()) || manualCode.trim()
      : extractQrToken(manualCode.trim()) || manualCode.trim();

    if (onScanSuccess) onScanSuccess(token, manualCode.trim());
    if (onScan) onScan({ registrationCode: manualCode.trim(), qrToken: token });
    setManualCode('');
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Modern Paytm-Style Optical Scanner Frame */}
        <div className="cyber-qr-scanner-card">
          <div className="cyber-qr-viewport">
            <div id={readerId}></div>

            {/* Dark Mask Vignette */}
            {isScanning && <div className="cyber-qr-mask" />}

            {/* Centered Paytm-Style Target Box with 4 Glowing Corners */}
            {isScanning && (
              <div className={`cyber-qr-target-box ${scanDetected ? 'is-success' : ''}`}>
                <div className="cyber-qr-corner top-left" />
                <div className="cyber-qr-corner top-right" />
                <div className="cyber-qr-corner bottom-left" />
                <div className="cyber-qr-corner bottom-right" />

                {/* Animated Scanning Laser Line */}
                <div className="cyber-qr-laser-line" />
              </div>
            )}

            {/* Loading / Starting Camera State */}
            {!isScanning && !errorMsg && (
              <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                <Camera size={48} color="#00f0ff" style={{ marginBottom: '12px' }} />
                <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
                  Starting optical camera preview...
                </p>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  Please grant camera access when prompted
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Live Instruction Pill or Paused Banner */}
        {isScanning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            {scanDetected ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.5)',
                  color: '#34d399',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={16} />
                <span>CODE CAPTURED • SCANNER PAUSED</span>
                <button
                  type="button"
                  onClick={resumeScanning}
                  style={{
                    marginLeft: '8px',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.3)',
                    border: '1px solid rgba(16, 185, 129, 0.6)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Scan Next</span>
                </button>
              </div>
            ) : (
              <div className="cyber-qr-instruction">
                <span className="cyber-qr-instruction-dot" />
                <span>ALIGN {mode === 'team' ? 'TEAM' : 'BADGE'} QR CODE INSIDE FRAME</span>
              </div>
            )}
          </div>
        )}

        {/* Error / Permission Denied Notification */}
        {errorMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              fontSize: '0.88rem',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Manual Lookup Form */}
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="cyber-login-input"
            style={{
              flex: 1,
              fontFamily: 'var(--font-mono, monospace)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
            placeholder={placeholder}
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Search size={18} />
            <span>Lookup</span>
          </button>
        </form>
      </div>
    </Modal>
  );
}

export default QrScannerModal;

