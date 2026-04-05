import {
  type CharacterFraming,
  buildCharacterImagePrompt,
  identicalPlainBackgroundPhrase,
} from "./character-framing";
import { aspectRatioToSize, seedreamI2ISizeMap } from "./utils";

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

const FETCH_RETRY_ATTEMPTS = 5;
const FETCH_RETRY_BASE_MS = 1000;

function isRetryableNetworkError(e: unknown): boolean {
  if (e instanceof TypeError) {
    const msg = e.message.toLowerCase();
    if (msg.includes("fetch")) return true;
  }
  const cause = (e as { cause?: { code?: string; name?: string } })?.cause;
  if (!cause) return false;
  const code = cause.code;
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "EPIPE" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }
  if (cause.name === "ConnectTimeoutError") return true;
  return false;
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504 || status === 429;
}

/**
 * Fetch with retries for transient network issues (e.g. UND_ERR_CONNECT_TIMEOUT on api.wavespeed.ai).
 */
async function wavespeedFetch(
  url: string,
  init: RequestInit
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < FETCH_RETRY_ATTEMPTS; i++) {
    try {
      const res = await fetch(url, init);
      if (isRetryableHttpStatus(res.status) && i < FETCH_RETRY_ATTEMPTS - 1) {
        await new Promise((r) =>
          setTimeout(r, FETCH_RETRY_BASE_MS * Math.pow(2, i))
        );
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (!isRetryableNetworkError(e) || i === FETCH_RETRY_ATTEMPTS - 1) {
        throw e;
      }
      await new Promise((r) =>
        setTimeout(r, FETCH_RETRY_BASE_MS * Math.pow(2, i))
      );
    }
  }
  throw lastError;
}

function getApiKey(): string {
  const key = process.env.WAVESPEED_API_KEY;
  if (!key) throw new Error("WAVESPEED_API_KEY is not configured");
  return key;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
  };
}

async function submitAndPoll(
  url: string,
  body: Record<string, unknown>,
  options?: { maxAttempts?: number; outputKind?: string }
): Promise<string> {
  const maxAttempts = options?.maxAttempts ?? MAX_POLL_ATTEMPTS;
  const outputKind = options?.outputKind ?? "output";

  const submitRes = await wavespeedFetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`WaveSpeed submit failed (${submitRes.status}): ${text}`);
  }

  const submitData = await submitRes.json();
  if (submitData.code !== 200 || !submitData.data?.id) {
    throw new Error(
      `WaveSpeed submit error: ${JSON.stringify(submitData)}`
    );
  }

  const requestId = submitData.data.id;
  const pollUrl = `${WAVESPEED_BASE}/predictions/${requestId}/result`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await wavespeedFetch(pollUrl, { headers: authHeaders() });
    } catch {
      continue;
    }
    if (!pollRes.ok) continue;

    let pollData: {
      data?: { status?: string; outputs?: unknown[] | unknown };
    };
    try {
      pollData = await pollRes.json();
    } catch {
      continue;
    }
    const status = pollData.data?.status;

    if (status === "completed") {
      const outs = pollData.data?.outputs;
      const raw = Array.isArray(outs) ? outs[0] : outs;
      const output =
        typeof raw === "string"
          ? raw
          : raw &&
              typeof raw === "object" &&
              "url" in raw &&
              typeof (raw as { url: unknown }).url === "string"
            ? (raw as { url: string }).url
            : null;
      if (!output) {
        throw new Error(`WaveSpeed completed but no ${outputKind}`);
      }
      return output;
    }

    if (status === "failed" || status === "error") {
      throw new Error(
        `WaveSpeed job failed: ${JSON.stringify(pollData.data)}`
      );
    }
  }

  throw new Error("WaveSpeed job timed out after polling");
}

const IMAGE_TO_VIDEO_MAX_POLL_ATTEMPTS = 180;
const IMAGE_TO_VIDEO_JOB_RETRIES = 3;
const IMAGE_TO_VIDEO_RETRY_BASE_MS = 2000;

const MULTI_POSE_MAX_POLL_ATTEMPTS = 120;

async function submitAndPollAllOutputs(
  url: string,
  body: Record<string, unknown>
): Promise<string[]> {
  const submitRes = await wavespeedFetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!submitRes.ok) {
    const text = await submitRes.text();
    throw new Error(`WaveSpeed submit failed (${submitRes.status}): ${text}`);
  }

  const submitData = await submitRes.json();
  if (submitData.code !== 200 || !submitData.data?.id) {
    throw new Error(
      `WaveSpeed submit error: ${JSON.stringify(submitData)}`
    );
  }

  const requestId = submitData.data.id;
  const pollUrl = `${WAVESPEED_BASE}/predictions/${requestId}/result`;

  for (let attempt = 0; attempt < MULTI_POSE_MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    let pollRes: Response;
    try {
      pollRes = await wavespeedFetch(pollUrl, { headers: authHeaders() });
    } catch {
      continue;
    }
    if (!pollRes.ok) continue;

    let pollData: { data?: { status?: string; outputs?: unknown } };
    try {
      pollData = await pollRes.json();
    } catch {
      continue;
    }
    const status = pollData.data?.status;

    if (status === "completed") {
      const raw = pollData.data?.outputs;
      const list: string[] = [];
      if (Array.isArray(raw)) {
        for (const o of raw) {
          if (typeof o === "string") list.push(o);
          else if (
            o &&
            typeof o === "object" &&
            "url" in o &&
            typeof (o as { url: unknown }).url === "string"
          ) {
            list.push((o as { url: string }).url);
          }
        }
      } else if (typeof raw === "string") {
        list.push(raw);
      }
      if (!list.length) {
        throw new Error("WaveSpeed completed but no output images");
      }
      return list;
    }

    if (status === "failed" || status === "error") {
      throw new Error(
        `WaveSpeed job failed: ${JSON.stringify(pollData.data)}`
      );
    }
  }

  throw new Error("WaveSpeed job timed out after polling");
}

function buildModelSpecificBody(
  model: string,
  baseBody: Record<string, unknown>
): Record<string, unknown> {
  const body = { ...baseBody };

  if (model.includes("cogview-4")) {
    body.quality = "hd";
  } else if (model.includes("qwen-image/text-to-image-2512-lora")) {
    body.loras = [];
    body.output_format = "jpeg";
    body.seed = -1;
  } else if (model.includes("wan-2.5/text-to-image")) {
    body.enable_prompt_expansion = false;
    body.seed = -1;
  }
  // bytedance/seedream-v4 and wavespeed-ai/z-image/turbo use defaults only

  return body;
}

export async function generateImage(
  prompt: string,
  aspectRatio: string,
  style: string,
  model: string,
  promptEnhancer: string | null,
  framing: CharacterFraming
): Promise<{ imageUrls: string[]; prompt: string }> {
  const fullPrompt = buildCharacterImagePrompt(
    prompt,
    promptEnhancer,
    framing
  );

  const size = aspectRatioToSize[aspectRatio] || aspectRatioToSize["1:1"];

  const baseBody = {
    enable_base64_output: false,
    enable_sync_mode: false,
    prompt: fullPrompt,
    size,
  };

  const body = buildModelSpecificBody(model, baseBody);
  const url = `${WAVESPEED_BASE}/${model}`;

  const imageUrl = await submitAndPoll(url, body);
  return { imageUrls: [imageUrl], prompt: fullPrompt };
}

export async function imageToImage(
  imageUrl: string,
  prompt: string,
  promptEnhancer: string | null,
  aspectRatio: string,
  framing: CharacterFraming
): Promise<{ imageUrl: string; prompt: string }> {
  const fullPrompt = buildCharacterImagePrompt(
    prompt,
    promptEnhancer,
    framing
  );

  const size = seedreamI2ISizeMap[aspectRatio] || seedreamI2ISizeMap["1:1"];

  const body = {
    enable_base64_output: false,
    enable_sync_mode: false,
    images: [imageUrl],
    prompt: fullPrompt,
    size,
  };

  const url = `${WAVESPEED_BASE}/bytedance/seedream-v4.5/edit`;
  const outputUrl = await submitAndPoll(url, body);
  return { imageUrl: outputUrl, prompt: fullPrompt };
}

export async function changeCameraAngle(
  imageUrl: string,
  horizontalAngle: number,
  verticalAngle: number,
  distance: number
): Promise<{ imageUrl: string }> {
  const horizontalForApi = horizontalAngle < 0 ? horizontalAngle + 360 : horizontalAngle;
  const verticalForApi = Math.min(
    60,
    Math.max(0, Math.round(((verticalAngle + 90) / 180) * 60))
  );

  const body = {
    distance,
    enable_base64_output: false,
    enable_sync_mode: false,
    horizontal_angle: horizontalForApi,
    images: [imageUrl],
    output_format: "jpeg",
    seed: -1,
    vertical_angle: verticalForApi,
  };

  const url = `${WAVESPEED_BASE}/wavespeed-ai/qwen-image/edit-multiple-angles`;
  const outputUrl = await submitAndPoll(url, body);
  return { imageUrl: outputUrl };
}

export async function editSequentialMultiPose(
  referenceImageUrl: string,
  sequencePrompt: string,
  framing: Pick<CharacterFraming, "background">
): Promise<{ imageUrls: string[] }> {
  const bgPhrase = identicalPlainBackgroundPhrase(framing.background);
  const prompt = `Use the provided image as the character reference. Every output must show only the character on an ${bgPhrase}—no scenery, environment, or props. Keep that same background color and simplicity consistent across all six images. Only vary pose and expression as specified below.\n\n${sequencePrompt}`;

  const body = {
    enable_base64_output: false,
    enable_sync_mode: false,
    images: [referenceImageUrl],
    max_images: 6,
    prompt,
  };

  const url = `${WAVESPEED_BASE}/bytedance/seedream-v4.5/edit-sequential`;
  const imageUrls = await submitAndPollAllOutputs(url, body);
  return { imageUrls };
}

const NANO_BANANA_EDIT_URL = `${WAVESPEED_BASE}/google/nano-banana-2/edit`;

const NANO_BANANA_DEFAULT_ASPECT = "1:1";

/**
 * One Nano Banana image edit (image-to-image). Each multi-expression variant uses the same reference URL with a different prompt.
 */
export async function nanoBananaEdit(
  referenceImageUrl: string,
  prompt: string,
  options: { aspectRatio: string; resolution?: string }
): Promise<string> {
  const aspect =
    options.aspectRatio in aspectRatioToSize
      ? options.aspectRatio
      : NANO_BANANA_DEFAULT_ASPECT;

  const body = {
    aspect_ratio: aspect,
    enable_base64_output: false,
    enable_image_search: false,
    enable_sync_mode: false,
    enable_web_search: false,
    images: [referenceImageUrl],
    output_format: "png",
    prompt,
    resolution: options.resolution ?? "1k",
  };

  return submitAndPoll(NANO_BANANA_EDIT_URL, body);
}

export async function editMultiExpressionNanoBanana(
  referenceImageUrl: string,
  prompts: string[],
  aspectRatio: string
): Promise<{ imageUrls: string[] }> {
  if (prompts.length !== 6) {
    throw new Error("Multi-expression requires exactly 6 prompts");
  }
  const imageUrls = await Promise.all(
    prompts.map((p) =>
      nanoBananaEdit(referenceImageUrl, p, { aspectRatio })
    )
  );
  return { imageUrls };
}

export async function imageToVideoFlash(
  imageUrl: string,
  prompt: string
): Promise<string> {
  const body = {
    duration: 3,
    enable_audio: false,
    enable_prompt_expansion: false,
    image: imageUrl,
    prompt,
    resolution: "720p",
    seed: -1,
    shot_type: "single",
  };

  const url = `${WAVESPEED_BASE}/alibaba/wan-2.6/image-to-video-flash`;

  let lastError: unknown;
  for (let attempt = 0; attempt < IMAGE_TO_VIDEO_JOB_RETRIES; attempt++) {
    try {
      return await submitAndPoll(url, body, {
        maxAttempts: IMAGE_TO_VIDEO_MAX_POLL_ATTEMPTS,
        outputKind: "video",
      });
    } catch (e) {
      lastError = e;
      if (attempt < IMAGE_TO_VIDEO_JOB_RETRIES - 1) {
        const delay =
          IMAGE_TO_VIDEO_RETRY_BASE_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
