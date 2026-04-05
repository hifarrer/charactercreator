import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { validatePrompt } from "@/lib/profanity-filter";
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

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { imageUrl, prompt } = body as {
      imageUrl?: string;
      prompt?: string;
    };

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    const motionPrompt = typeof prompt === "string" ? prompt.trim() : "";
    if (!motionPrompt) {
      return NextResponse.json(
        { error: "prompt is required" },
        { status: 400 }
      );
    }

    const validation = validatePrompt(motionPrompt, null);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }

    const publicImageUrl = ensurePublicUrl(imageUrl, request);
    const videoUrl = await imageToVideoFlash(publicImageUrl, motionPrompt);

    return NextResponse.json({ videoUrl });
  } catch (error) {
    console.error("Video-from-image error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Video generation failed",
      },
      { status: 500 }
    );
  }
}
