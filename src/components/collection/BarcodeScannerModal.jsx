import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'

// Hints : restreint aux formats EAN/UPC (plus rapide et plus fiable sur mobile)
const SCAN_HINTS = new Map([
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E],
  ],
  [DecodeHintType.TRY_HARDER, true],
])

export function BarcodeScannerModal({ open, onScan, onClose }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)
  const onScanRef = useRef(onScan)
  const [cameraError, setCameraError] = useState(null)

  // Garde onScan à jour sans redémarrer l'effet
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!open) return

    setCameraError(null)
    let stopped = false

    async function start() {
      try {
        if (!readerRef.current) {
          readerRef.current = new BrowserMultiFormatReader(SCAN_HINTS)
        }

        if (stopped) return

        // decodeFromConstraints : demande directement la caméra arrière
        // à haute résolution — plus fiable que sélection par deviceId
        controlsRef.current = await readerRef.current.decodeFromConstraints(
          {
            video: {
              facingMode: 'environment',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
          videoRef.current,
          (result, _err, controls) => {
            if (result) {
              controls.stop()
              onScanRef.current(result.getText())
            }
          },
        )
      } catch (err) {
        if (!stopped) {
          if (err.name === 'NotAllowedError') {
            setCameraError(
              'Accès à la caméra refusé. Autorise la caméra dans les réglages du navigateur.',
            )
          } else {
            setCameraError("Impossible d'accéder à la caméra : " + err.message)
          }
        }
      }
    }

    start()

    return () => {
      stopped = true
      try {
        controlsRef.current?.stop()
      } catch {
        // ignore
      }
      controlsRef.current = null
    }
  }, [open]) // onScan retiré des deps — géré via ref

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
      >
        <h2 className="text-base font-semibold text-white">Scanner un code-barres</h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
          aria-label="Fermer"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {cameraError ? (
        /* Error state */
        <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-400/10 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed max-w-xs">{cameraError}</p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-amber-400 text-zinc-950 rounded-xl text-sm font-semibold"
          >
            Saisie manuelle
          </button>
        </div>
      ) : (
        /* Camera view */
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />

          {/* Scan frame */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative w-72 h-44">
              {/* Corner brackets */}
              <span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-amber-400 rounded-tl-lg" />
              <span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-amber-400 rounded-tr-lg" />
              <span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-amber-400 rounded-bl-lg" />
              <span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-amber-400 rounded-br-lg" />

              {/* Scanning line animation */}
              <div className="absolute inset-x-2 top-0 h-0.5 bg-amber-400/70 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
            <p className="mt-6 text-white/70 text-sm text-center px-8">
              Pointez la caméra vers le code-barres de la boîte
            </p>
          </div>
        </div>
      )}

      {/* Bottom safe area */}
      <div className="shrink-0" style={{ height: 'env(safe-area-inset-bottom)' }} />
    </div>
  )
}
