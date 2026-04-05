import { aspectRatioToSize, seedreamI2ISizeMap } from "./utils";

const WAVESPEED_BASE = "https://api.wavespeed.ai/api/v3";
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60;

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

async function submitAndPoll(url: string, body: Record<string, unknown>): Promise<string> {
  const submitRes = await fetch(url, {
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

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollRes = await fetch(pollUrl, { headers: authHeaders() });
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
    const status = pollData.data?.status;

    if (status === "completed") {
      const output = pollData.data?.outputs?.[0];
      if (!output) throw new Error("WaveSpeed completed but no output image");
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

const MULTI_POSE_MAX_POLL_ATTEMPTS = 120;

async function submitAndPollAllOutputs(
  url: string,
  body: Record<string, unknown>
): Promise<string[]> {
  const submitRes = await fetch(url, {
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

    const pollRes = await fetch(pollUrl, { headers: authHeaders() });
    if (!pollRes.ok) continue;

    const pollData = await pollRes.json();
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
  promptEnhancer: string | null
): Promise<{ imageUrls: string[]; prompt: string }> {
  const fullPrompt = promptEnhancer
    ? `front shot of a ${prompt}, ${promptEnhancer}`
    : `front shot of a ${prompt}`;

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
  aspectRatio: string
): Promise<{ imageUrl: string; prompt: string }> {
  const fullPrompt = promptEnhancer
    ? `front shot of a ${prompt}, ${promptEnhancer}`
    : `front shot of a ${prompt}`;

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
  sequencePrompt: string
): Promise<{ imageUrls: string[] }> {
  const prompt = `Use the provided image as the character reference. Keep the same background, environment, and lighting in every output; only vary pose and expression as specified below.\n\n${sequencePrompt}`;

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
