import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { validatePrompt } from "@/lib/profanity-filter";
import { imageToImage } from "@/lib/wavespeed";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { imageUrl, prompt, promptEnhancer, aspectRatio } = body;

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: "imageUrl and prompt are required" },
        { status: 400 }
      );
    }

    const validation = validatePrompt(prompt, promptEnhancer);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.reason },
        { status: 400 }
      );
    }

    const publicImageUrl = ensurePublicUrl(imageUrl, request);

    const result = await imageToImage(
      publicImageUrl,
      prompt,
      promptEnhancer || null,
      aspectRatio || "1:1"
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Image-to-image error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image-to-image failed" },
      { status: 500 }
    );
  }
}

function ensurePublicUrl(imageUrl: string, request: NextRequest): string {
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }
  const origin = request.headers.get("origin") || request.nextUrl.origin;
  return `${origin}${imageUrl}`;
}
