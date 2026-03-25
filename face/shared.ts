/** face-api.js bundle (browser script tag). */
export const FACE_API_CDN_SCRIPT =
  "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";

/** Max euclidean distance for “same person” (face-api.js recognition). */
export const FACE_MATCH_THRESHOLD = 0.48;

/** Same options as server `generateFaceDescriptorFromImageFilePath` and kiosk capture. */
export const TINY_FACE_DETECTOR_OPTIONS = {
  inputSize: 416,
  scoreThreshold: 0.4,
} as const;

/** Models served under `/public/zodula/face-api-models` (see `apps/zodula/public/face-api-models`). */
export function publicFaceApiModelsPath(origin: string): string {
  return `${String(origin).replace(/\/$/, "")}/public/zodula/face-api-models`;
}

/** Parse stored JSON / array face descriptor. */
export function parseFaceDescriptor(value: unknown): number[] | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    const nums = value.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    return nums.length > 0 ? nums : null;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const nums = parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n));
        return nums.length > 0 ? nums : null;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function euclideanDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const len = a.length;
  if (len !== b.length) {
    throw new Error("Face descriptor length mismatch");
  }
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const d = Number(a[i]) - Number(b[i]);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function findBestFaceMatch<T extends { descriptor: number[] }>(
  liveDescriptor: number[],
  profiles: T[],
  maxDistance: number = FACE_MATCH_THRESHOLD
): { profile: T; distance: number } | null {
  let best: { profile: T; distance: number } | null = null;
  for (const p of profiles) {
    const distance = euclideanDistance(liveDescriptor, p.descriptor);
    if (!best || distance < best.distance) best = { profile: p, distance };
  }
  if (!best || best.distance > maxDistance) return null;
  return best;
}
