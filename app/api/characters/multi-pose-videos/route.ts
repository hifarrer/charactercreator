import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { parseCharacterFraming } from "@/lib/character-framing";
import { validatePrompt } from "@/lib/profanity-filter";
import { generatePoseVideoPrompts } from "@/lib/multipose-video-prompts";
import { imageToVideoFlash } from "@/lib/wavespeed";

export const maxDuration = 800;

function ensurePublicUrl(imageUrl: string, request: NextRequest): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const origin = request.headers.get("origin") || request.nextUrl.origin;
  const path = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${origin}${path}`;
}

/** Parallel first pass; retry only failed slots after a short pause (each slot already retries inside imageToVideoFlash). */
async function generateAllPoseVideos(
  publicUrls: string[],
  videoPrompts: string[]
): Promise<string[]> {
  const n = publicUrls.length;
  const videoUrls: (string | undefined)[] = Array(n);

  const runForIndices = (indices: number[]) =>
    Promise.allSettled(
      indices.map((i) => imageToVideoFlash(publicUrls[i], videoPrompts[i]))
    );

  let pending = publicUrls.map((_, i) => i);

  for (let pass = 0; pass < 2 && pending.length > 0; pass++) {
    if (pass > 0) {
      await new Promise((r) => setTimeout(r, 4000));
    }
    const settled = await runForIndices(pending);
    settled.forEach((result, j) => {
      const i = pending[j];
      if (result.status === "fulfilled") {
        videoUrls[i] = result.value;
      }
    });
    pending = pending.filter((i) => videoUrls[i] === undefined);
  }

  if (pending.length > 0) {
    throw new Error(
      `Video generation failed after retries for clip(s): ${pending.map((i) => i + 1).join(", ")}`
    );
  }

  return videoUrls as string[];
}

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { imageUrls, sequencePrompt, context, videoKind } = body as {
      imageUrls?: string[];
      sequencePrompt?: string;
      context?: string;
      videoKind?: string;
    };

    const kind =
      videoKind === "expression" ? ("expression" as const) : ("pose" as const);
    const framing = parseCharacterFraming(body);

    if (!Array.isArray(imageUrls) || imageUrls.length !== 6) {
      return NextResponse.json(
        { error: "imageUrls must be an array of exactly 6 URLs" },
        { status: 400 }
      );
    }

    if (!sequencePrompt || typeof sequencePrompt !== "string") {
      return NextResponse.json(
        { error: "sequencePrompt is required" },
        { status: 400 }
      );
    }

    const ctx = typeof context === "string" ? context : "";
    if (ctx.trim()) {
      const validation = validatePrompt(ctx.trim(), null);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.reason },
          { status: 400 }
        );
      }
    }

    const videoPrompts = await generatePoseVideoPrompts(
      sequencePrompt,
      ctx,
      kind,
      {
        background: framing.background,
        shotType: framing.shotType,
      }
    );

    const publicUrls = imageUrls.map((u) => ensurePublicUrl(u, request));

    const videoUrls = await generateAllPoseVideos(publicUrls, videoPrompts);

    return NextResponse.json({ videoUrls, videoPrompts });
  } catch (error) {
    console.error("Sequential videos error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Video generation failed",
      },
      { status: 500 }
    );
  }
}
