import React, { useRef, useCallback, useEffect } from "react";
import { FormPlugin } from "../plugin";
import { Button } from "../../ui/button";
import { cn } from "@/zodula/ui/lib/utils";
import { popup, prompt } from "../../ui/popit";
import { Maximize2, PenLine } from "lucide-react";
import { zodula } from "@/zodula/client";
import { useAuthStore } from "@/zodula/ui/hooks/use-auth";
import { toast } from "../../ui/toast";

const CANVAS_WIDTH = 280;
const CANVAS_HEIGHT = 120;

const FULLSCREEN_CANVAS_WIDTH = 720;
const FULLSCREEN_CANVAS_HEIGHT = 320;
const MIN_SIGNATURE_KB = 1; // ignore tiny dots

function FullscreenSignatureContent({
  isOpen,
  onClose,
  initialData
}: {
  isOpen: boolean;
  onClose: (result?: string) => void;
  initialData?: { value?: string; label?: string };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const draw = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    ctx.stroke();
  }, []);

  const start = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getPoint(e);
    if (point) {
      isDrawing.current = true;
      lastPos.current = point;
    }
  }, [getPoint]);

  const move = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const point = getPoint(e);
    if (point && lastPos.current) {
      draw(lastPos.current, point);
      lastPos.current = point;
    }
  }, [getPoint, draw]);

  const end = useCallback(() => {
    isDrawing.current = false;
    lastPos.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isOpen) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const value = initialData?.value;
    if (value && value !== "") {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [isOpen, initialData?.value]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleDone = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const approxBytes = (dataUrl.length * 3) / 4;
    const approxKB = approxBytes / 1024;
    if (approxKB < MIN_SIGNATURE_KB) {
      onClose();
      return;
    }
    onClose(dataUrl);
  };

  if (!isOpen) return null;

  return (
    <div className="zd:flex zd:flex-col zd:gap-4">
      <canvas
        ref={canvasRef}
        width={FULLSCREEN_CANVAS_WIDTH}
        height={FULLSCREEN_CANVAS_HEIGHT}
        className={cn(
          "zd:w-full zd:max-w-full zd:border zd:border-border zd:rounded zd:cursor-crosshair zd:bg-white zd:touch-none"
        )}
        style={{ width: "100%", maxWidth: FULLSCREEN_CANVAS_WIDTH, height: FULLSCREEN_CANVAS_HEIGHT }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div className="zd:flex zd:gap-2 zd:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={handleClear}>
          Clear
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onClose()}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function useSignatureCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  value: string | undefined,
  readonly: boolean,
  onChange: ((fieldPath: string, value: any) => void) | undefined,
  fieldPath: string
) {
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getPoint = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, [canvasRef]);

  const draw = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    ctx.stroke();
  }, [canvasRef]);

  const emitChange = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onChange) return;
    const dataUrl = canvas.toDataURL("image/png");
    const approxBytes = (dataUrl.length * 3) / 4;
    const approxKB = approxBytes / 1024;
    if (approxKB < MIN_SIGNATURE_KB) {
      return;
    }
    onChange(fieldPath, dataUrl);
  }, [canvasRef, onChange, fieldPath]);

  const start = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readonly) return;
    e.preventDefault();
    const point = getPoint(e);
    if (point) {
      isDrawing.current = true;
      lastPos.current = point;
    }
  }, [readonly, getPoint]);

  const move = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current || readonly) return;
    e.preventDefault();
    const point = getPoint(e);
    if (point && lastPos.current) {
      draw(lastPos.current, point);
      lastPos.current = point;
    }
  }, [readonly, getPoint, draw]);

  const end = useCallback(() => {
    if (isDrawing.current) {
      isDrawing.current = false;
      lastPos.current = null;
      emitChange();
    }
  }, [emitChange]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!value || value === "") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
  }, [value, canvasRef]);

  return { start, move, end };
}

export const SignaturePlugin = new FormPlugin({
  types: ["Signature"] as const,
  render: (props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const value = props.value as string | undefined;
    const readonly = !!props.readonly;
    const approxSizeKB =
      value && value.startsWith("data:")
        ? Math.round((((value.length * 3) / 4) / 1024) * 10) / 10
        : 0;

    const { start, move, end } = useSignatureCanvas(
      canvasRef,
      value,
      readonly,
      props.onChange,
      props.fieldPath || ""
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, []);

    const handleClear = () => {
      const canvas = canvasRef.current;
      if (!canvas || readonly) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      props.onChange?.(props.fieldPath || "", "");
    };

    const fieldWidthPx = typeof props.fieldOptions.width === "number" && props.fieldOptions.width > 0
      ? props.fieldOptions.width
      : undefined;
    const fieldHeightPx = typeof props.fieldOptions.height === "number" && props.fieldOptions.height > 0
      ? props.fieldOptions.height
      : CANVAS_HEIGHT;

    if (readonly && value) {
      const displayWidth = fieldWidthPx ?? CANVAS_WIDTH;
      return (
        <div className="zd:space-y-1 zd:w-fit">
          <img
            src={value}
            alt={props.fieldOptions.label || "Signature"}
            className={cn("zd:border zd:border-border zd:rounded zd:bg-white zd:flex-shrink-0")}
            style={{
              width: displayWidth,
              height: fieldHeightPx,
              minWidth: displayWidth,
              minHeight: fieldHeightPx,
              objectFit: "contain",
            }}
          />
        </div>
      );
    }

    const handleFullscreen = () => {
      popup(FullscreenSignatureContent, {
        title: props.fieldOptions.label || "Sign",
        width: "95vw",
        maxWidth: "800px"
      }, { value, label: props.fieldOptions.label }).then((result) => {
        if (result != null) props.onChange?.(props.fieldPath || "", result);
      });
    };

    const handleQuickSign = async () => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) {
        toast.error("You must be logged in to use Quick Sign.");
        return;
      }
      const password = await prompt({
        title: "Quick Sign",
        message: "Enter your password to use your saved signature.",
        placeholder: "Password",
        required: true,
        type: "password",
      });
      if (password == null || password === "") return;
      try {
        await zodula.action("zodula.auth.verify_me" as any, { data: { password } });
        const userDoc = await zodula.doc.get_doc("User" as Zodula.DoctypeName, userId, { fields: ["signature"] }) as { signature?: string } | null;
        const sig = userDoc?.signature;
        if (sig && sig.startsWith("data:")) {
          props.onChange?.(props.fieldPath || "", sig);
          toast.success("Signature applied.");
        } else {
          toast.error("No signature saved on your account. Save your signature in your User profile first.");
        }
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? e?.message ?? "Verification failed.";
        toast.error(msg);
      }
    };

    const canvasWidth = fieldWidthPx ?? CANVAS_WIDTH;
    return (
      <div className="zd:space-y-2 zd:w-fit" style={{ maxWidth: fieldWidthPx ? undefined : "100%" }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={fieldHeightPx}
          className={cn(
            "zd:border zd:border-border zd:rounded zd:cursor-crosshair zd:bg-white zd:flex-shrink-0",
            "zd:touch-none"
          )}
          style={{
            width: canvasWidth,
            height: fieldHeightPx,
            minWidth: canvasWidth,
            minHeight: fieldHeightPx,
          }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        >

        </canvas>
        {!readonly && (
          <>
            <div className="zd:relative zd:flex zd:gap-2 zd:flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleQuickSign}
                title="Use your saved signature"
              >
                <PenLine className="zd:h-4 zd:w-4 zd:mr-1" />
                Quick Sign
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFullscreen}
                title="Sign in fullscreen"
              >
                <Maximize2 className="zd:h-4 zd:w-4" />
              </Button>
            </div>
            <p className="zd:text-[11px] zd:text-muted-foreground">
              Size: {approxSizeKB.toFixed(1)} KB
              {approxSizeKB > 0 && approxSizeKB < MIN_SIGNATURE_KB && " (too small, not saved)"}
            </p>
          </>
        )}
      </div>
    );
  },
  cellRender: (props) => {
    const value = props.value as string | undefined;
    if (!value) return <span className="zd:text-muted-foreground zd:italic">-</span>;
    return (
      <img
        src={value}
        alt=""
        className="zd:inline-block zd:max-h-8 zd:max-w-24 zd:object-contain zd:border zd:border-border zd:rounded"
      />
    );
  },
  renderFilter: (props) => {
    if (["IS NULL", "IS NOT NULL"].includes(props.operator || "")) return null;
    return null;
  }
});
