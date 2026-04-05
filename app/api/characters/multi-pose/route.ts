import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { parseCharacterFraming } from "@/lib/character-framing";
import { validatePrompt } from "@/lib/profanity-filter";
import { generateMultiPoseSequencePrompt } from "@/lib/multipose-prompt";
import { editSequentialMultiPose } from "@/lib/wavespeed";

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
    const { imageUrl, context } = body as {
      imageUrl?: string;
      context?: string;
    };
    const framing = parseCharacterFraming(body);

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "imageUrl is required" },
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

    const publicImageUrl = ensurePublicUrl(imageUrl, request);
    const sequencePrompt = await generateMultiPoseSequencePrompt(ctx, framing);
    const { imageUrls } = await editSequentialMultiPose(
      publicImageUrl,
      sequencePrompt,
      framing
    );

    return NextResponse.json({
      imageUrls,
      sequencePrompt,
    });
  } catch (error) {
    console.error("Multi-pose error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Multi-pose generation failed",
      },
      { status: 500 }
    );
  }
}
