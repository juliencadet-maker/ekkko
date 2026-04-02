import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Camera, Square, RotateCcw, Check, Circle } from "lucide-react";

type RecordingState = "idle" | "recording" | "recorded";

interface FacecamRecorderProps {
  company: string;
  contactName: string;
  onRecorded: (blob: Blob) => void;
  onClear: () => void;
  recordedBlob: Blob | null;
  /** When provided, use this text for the teleprompter instead of internal script */
  externalScript?: string;
  /** When true, show the teleprompter overlay with externalScript */
  showTeleprompter?: boolean;
}

export function FacecamRecorder({
  company,
  contactName,
  onRecorded,
  onClear,
  recordedBlob,
  externalScript = "",
  showTeleprompter = false,
}: FacecamRecorderProps) {
  const isMobile = useIsMobile();
  const [state, setState] = useState<RecordingState>(recordedBlob ? "recorded" : "idle");
  const [cameraReady, setCameraReady] = useState(false);

  const teleprompterText = showTeleprompter ? externalScript : "";

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const scrollIntervalRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraReady(true);
    } catch (err) {
      console.error("Camera access error:", err);
    }
  }, []);

  useEffect(() => {
    if (!recordedBlob) {
      startCamera();
    }
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getMimeType = () => {
    if (typeof MediaRecorder === "undefined") return "";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) return "video/webm;codecs=vp9,opus";
    if (MediaRecorder.isTypeSupported("video/webm")) return "video/webm";
    if (MediaRecorder.isTypeSupported("video/mp4")) return "video/mp4";
    return "";
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = getMimeType();
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
      onRecorded(blob);
      setState("recorded");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = URL.createObjectURL(blob);
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    setState("recording");

    // Auto-scroll teleprompter
    if (teleprompterRef.current) {
      teleprompterRef.current.scrollTop = 0;
      scrollIntervalRef.current = window.setInterval(() => {
        teleprompterRef.current?.scrollBy({ top: 1 });
      }, 50);
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  const retry = () => {
    onClear();
    setState("idle");
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    startCamera();
    if (teleprompterRef.current) teleprompterRef.current.scrollTop = 0;
  };

  // ── RECORDED ──
  if (state === "recorded" || recordedBlob) {
    const url = previewUrlRef.current || (recordedBlob ? URL.createObjectURL(recordedBlob) : null);
    return (
      <div className="space-y-4">
        <video src={url || undefined} controls className="w-full rounded-lg bg-black aspect-video" />
        <div className="flex gap-3">
          <Button variant="outline" onClick={retry} className="gap-2 min-h-12">
            <RotateCcw className="h-4 w-4" /> Recommencer
          </Button>
          <Button className="flex-1 gap-2 min-h-12 bg-signal/20 text-signal cursor-default" disabled>
            <Check className="h-4 w-4" /> Vidéo prête
          </Button>
        </div>
      </div>
    );
  }

  // ── IDLE / RECORDING ──
  return (
    <div className="space-y-4">
      {/* Camera view */}
      <div className="relative">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full rounded-lg bg-black aspect-video"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Desktop teleprompter overlay */}
        {!isMobile && teleprompterText.trim() && (
          <div
            ref={teleprompterRef}
            className="absolute bottom-0 left-0 right-0 max-h-[40%] overflow-y-auto p-4 bg-black/60 rounded-b-lg"
          >
            <p className="text-white text-center text-sm whitespace-pre-wrap leading-relaxed">{teleprompterText}</p>
          </div>
        )}

        {/* Recording indicator */}
        {state === "recording" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-destructive/90 text-white px-3 py-1 rounded-full text-xs font-medium">
            <Circle className="h-2 w-2 fill-current animate-pulse" />
            REC
          </div>
        )}
      </div>

      {/* Mobile teleprompter below video */}
      {isMobile && teleprompterText.trim() && (
        <div
          ref={teleprompterRef}
          className="max-h-32 overflow-y-auto p-3 bg-muted rounded-lg"
        >
          <p className="text-foreground text-center whitespace-pre-wrap leading-relaxed" style={{ fontSize: "18px" }}>
            {teleprompterText}
          </p>
        </div>
      )}

      {/* Record controls */}
      <div className="flex justify-center">
        {state === "idle" && (
          <Button
            onClick={startRecording}
            disabled={!cameraReady}
            className="min-h-12 px-8 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Camera className="h-5 w-5" /> Enregistrer
          </Button>
        )}
        {state === "recording" && (
          <Button
            onClick={stopRecording}
            className="min-h-12 px-8 gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            <Square className="h-5 w-5" /> Arrêter
          </Button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        L'enregistrement est possible même sans script
      </p>
    </div>
  );
}
