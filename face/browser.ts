import { FACE_API_CDN_SCRIPT, publicFaceApiModelsPath } from "./shared";

export type FaceApiShape = {
  nets: {
    tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (uri: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (uri: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (opts?: { inputSize?: number; scoreThreshold?: number }) => any;
  detectSingleFace: (input: HTMLVideoElement, opts: any) => {
    withFaceLandmarks: () => { withFaceDescriptor: () => Promise<{ descriptor: Float32Array } | undefined> };
  };
  euclideanDistance: (a: number[] | Float32Array, b: number[] | Float32Array) => number;
};

declare global {
  interface Window {
    faceapi?: FaceApiShape;
  }
}

export async function ensureFaceApiScript(): Promise<FaceApiShape> {
  if (typeof window === "undefined") {
    throw new Error("ensureFaceApiScript is browser-only");
  }
  if (window.faceapi) return window.faceapi;
  const script = document.createElement("script");
  script.src = FACE_API_CDN_SCRIPT;
  script.async = true;
  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load face-api.js"));
    document.head.appendChild(script);
  });
  if (!window.faceapi) throw new Error("face-api.js not available");
  return window.faceapi;
}

export async function loadFaceApiModelsFromPublic(
  faceapi: FaceApiShape,
  origin: string
): Promise<void> {
  const modelBase = publicFaceApiModelsPath(origin);
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(modelBase),
    faceapi.nets.faceLandmark68Net.loadFromUri(modelBase),
    faceapi.nets.faceRecognitionNet.loadFromUri(modelBase),
  ]);
}
