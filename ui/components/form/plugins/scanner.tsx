import React, { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { ScanLine } from "lucide-react";
import { FormPlugin } from "../plugin";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { popup } from "../../ui/popit";

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: { ideal: "environment" } },
  audio: false,
};

export function ScannerDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: (result?: string) => void;
  initialData?: { value?: string };
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<{ detect: (v: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } | null>(null);
  const timerRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const hasBarcodeDetector = typeof window !== "undefined" && "BarcodeDetector" in window;

    const cleanupNative = () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      detectorRef.current = null;
    };

    const cleanupZxing = () => {
      zxingControlsRef.current?.stop();
      zxingControlsRef.current = null;
    };

    const startNative = async () => {
      try {
        const BarcodeDetectorCtor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue?: string }[]> } }).BarcodeDetector;
        detectorRef.current = new BarcodeDetectorCtor({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"],
        });
        const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
        if (cancelled) return;
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        timerRef.current = window.setInterval(async () => {
          try {
            const v = videoRef.current;
            const det = detectorRef.current;
            if (!v || !det || v.readyState < 2) return;
            const codes = await det.detect(v);
            if (!codes || codes.length === 0) return;
            const value = String(codes[0]?.rawValue ?? "").trim();
            if (!value) return;
            onClose(value);
          } catch {
            // ignore per-frame detect errors
          }
        }, 250);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Cannot access camera.";
        setError(msg);
      }
    };

    const startZxing = async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 200,
          delayBetweenScanSuccess: 200,
        });
        reader.possibleFormats = [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
        ];
        const video = videoRef.current;
        if (!video) {
          setError("Camera preview is not ready.");
          return;
        }
        const controls = await reader.decodeFromConstraints(VIDEO_CONSTRAINTS, video, (result, _err, ctrl) => {
          if (cancelled) return;
          if (!result) return;
          const value = String(result.getText() ?? "").trim();
          if (!value) return;
          ctrl.stop();
          onClose(value);
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        zxingControlsRef.current = controls;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Cannot access camera.";
        setError(msg);
      }
    };

    if (hasBarcodeDetector) void startNative();
    else void startZxing();

    return () => {
      cancelled = true;
      cleanupNative();
      cleanupZxing();
    };
  }, [isOpen, onClose]);

  return (
    <div className="zd:flex zd:flex-col zd:gap-3">
      <div className="zd:text-sm zd:text-muted-foreground">
        Point camera at QR code or barcode.
      </div>
      <div className="zd:rounded zd:border zd:overflow-hidden zd:bg-black">
        <video ref={videoRef} className="zd:w-full zd:h-[320px] zd:object-cover" muted playsInline autoPlay />
      </div>
      {error ? <div className="zd:text-sm zd:text-destructive">{error}</div> : null}
      <div className="zd:flex zd:justify-end zd:gap-2">
        <Button type="button" variant="outline" onClick={() => onClose()}>
          Close
        </Button>
      </div>
    </div>
  );
}

export const ScannerPlugin = new FormPlugin({
  types: ["Scanner"] as const,
  render: (props) => {
    const value = props.value ?? "";
    const openScanner = async () => {
      if (props.readonly) return;
      const result = await popup<string>(ScannerDialog, {
        title: "Scan QR / Barcode",
        maxWidth: "720px",
        width: "90vw",
      });
      if (result) {
        props.onChange?.(props.fieldPath || "", result);
      }
    };

    const suffix = (
      <button
        type="button"
        tabIndex={-1}
        onClick={openScanner}
        className="zd:flex zd:items-center zd:justify-center zd:p-0 zd:bg-transparent zd:border-none zd:cursor-pointer zd:hover:text-foreground zd:transition-colors"
        aria-label="Open scanner"
      >
        <ScanLine className="zd:h-4 zd:w-4" />
      </button>
    );

    return (
      <Input
        name={props.fieldPath || ""}
        id={props.fieldPath || ""}
        placeholder={props.placeholder || ""}
        type="text"
        value={value}
        readOnly={props.readonly}
        onChange={(e) => props.onChange?.(props.fieldPath || "", e.target.value)}
        suffix={suffix}
      />
    );
  },
  cellRender: (props) => {
    return <span className="zd:truncate">{String(props.value || "-")}</span>;
  },
});
