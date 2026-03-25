import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import * as faceapi from "face-api.js";
import { TINY_FACE_DETECTOR_OPTIONS } from "./shared";

/** Vendored weights under `apps/zodula/public/face-api-models` (served at `/public/zodula/face-api-models`). */
const DEFAULT_FACE_MODEL_DIR = path.join(process.cwd(), "apps/zodula/public/face-api-models");

export function faceModelDir(): string {
  const fromEnv = process.env.FACE_API_MODEL_DIR?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_FACE_MODEL_DIR;
}

let modelsLoading: Promise<void> | null = null;

export function ensureFaceModelsLoaded(): Promise<void> {
  if (!modelsLoading) {
    modelsLoading = (async () => {
      const dir = faceModelDir();
      await fs.access(dir);
      await faceapi.nets.tinyFaceDetector.loadFromDisk(dir);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(dir);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(dir);
    })();
  }
  return modelsLoading;
}

/** Maps stored File URL `/files/...` to absolute filesystem path under `.zodula_data/files`. */
export function zodulaFileUrlToAbsolutePath(fileUrl: string): string | null {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  const trimmed = fileUrl.trim();
  if (!trimmed.startsWith("/files/")) return null;
  const rel = trimmed.slice("/files/".length);
  if (!rel) return null;
  return path.join(process.cwd(), ".zodula_data", "files", rel);
}

/**
 * Runs TinyFaceDetector + landmarks + FaceRecognitionNet on an image file (same pipeline as kiosk).
 */
export async function generateFaceDescriptorFromImageFilePath(absPath: string): Promise<number[]> {
  await ensureFaceModelsLoaded();

  const { data, info } = await sharp(absPath)
    .rotate()
    .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const channels = info.channels;
  let rgb: Uint8Array;

  if (channels === 4) {
    rgb = new Uint8Array(w * h * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      rgb[j] = data[i]!;
      rgb[j + 1] = data[i + 1]!;
      rgb[j + 2] = data[i + 2]!;
    }
  } else if (channels === 3) {
    rgb = new Uint8Array(data);
  } else if (channels === 1) {
    rgb = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      const g = data[i]!;
      rgb[i * 3] = g;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = g;
    }
  } else {
    throw new Error(`Unsupported image channel count: ${channels}`);
  }

  const tf = faceapi.tf;
  const tensor = tf.tensor3d(Array.from(rgb), [h, w, 3], "int32");
  try {
    const detection = await faceapi
      .detectSingleFace(
        tensor as any,
        new faceapi.TinyFaceDetectorOptions({ ...TINY_FACE_DETECTOR_OPTIONS })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection?.descriptor) {
      throw new Error("No face detected in employee_image. Use a clear frontal photo.");
    }
    return Array.from(detection.descriptor);
  } finally {
    tensor.dispose();
  }
}
