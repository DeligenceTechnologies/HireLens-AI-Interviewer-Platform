// Browser-side face model (open-source face-api, models served from /models/face).
// Faces are analysed on the candidate's device; only small JPEG photos and
// 128-number descriptors are sent to the server.

type FaceApi = typeof import("@vladmandic/face-api");

const MODEL_URL = "/models/face";
let loading: Promise<FaceApi> | null = null;

/** Load the face model once per page. Rejects when the browser can't run it. */
export function loadFaceModel(): Promise<FaceApi> {
  loading ??= (async () => {
    const faceapi = await import("@vladmandic/face-api");
    // The bundled TensorFlow.js has these; face-api's type definitions leave them out.
    const tf = faceapi.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
    const gpu = await tf.setBackend("webgl").catch(() => false);
    if (!gpu) await tf.setBackend("cpu");
    await tf.ready();
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    return faceapi;
  })();
  loading.catch(() => { loading = null; });
  return loading;
}

export type FaceScan = {
  faces: number;
  /** Descriptor of the only face, when exactly one is visible. */
  descriptor: number[] | null;
  /** Width of the only face as a share of the frame (too small = too far away). */
  size: number | null;
};

export async function scanFaces(faceapi: FaceApi, video: HTMLVideoElement): Promise<FaceScan> {
  if (!video.videoWidth || video.readyState < 2) return { faces: 0, descriptor: null, size: null };
  const results = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true)
    .withFaceDescriptors();
  if (results.length !== 1) return { faces: results.length, descriptor: null, size: null };
  const r = results[0];
  return { faces: 1, descriptor: Array.from(r.descriptor), size: r.detection.box.width / video.videoWidth };
}

/** A small JPEG of the current video frame. */
export function snapshot(video: HTMLVideoElement, maxWidth = 480): Promise<Blob | null> {
  if (!video.videoWidth) return Promise.resolve(null);
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.75));
}

export async function uploadFace(url: string, meta: Record<string, unknown>, image: Blob | null) {
  const form = new FormData();
  form.set("meta", JSON.stringify(meta));
  if (image) form.set("image", image, "face.jpg");
  const res = await fetch(url, { method: "POST", body: form });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Upload failed");
  }
}
