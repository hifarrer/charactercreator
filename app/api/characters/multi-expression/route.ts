import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { parseCharacterFraming } from "@/lib/character-framing";
import { validatePrompt } from "@/lib/profanity-filter";
import { generateMultiExpressionImagePrompts } from "@/lib/multiexpression-prompt";
import { ASPECT_RATIOS, type AspectRatio } from "@/lib/utils";
import { editMultiExpressionNanoBanana } from "@/lib/wavespeed";

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
    const { imageUrl, context, aspectRatio } = body as {
      imageUrl?: string;
      context?: string;
      aspectRatio?: string;
    };

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
    const ratio =
      typeof aspectRatio === "string" &&
      (ASPECT_RATIOS as readonly string[]).includes(aspectRatio)
        ? (aspectRatio as AspectRatio)
        : ("1:1" as AspectRatio);

    const framing = parseCharacterFraming(body);

    const { prompts, sequencePrompt } =
      await generateMultiExpressionImagePrompts(ctx, framing);
    const { imageUrls } = await editMultiExpressionNanoBanana(
      publicImageUrl,
      prompts,
      ratio
    );

    return NextResponse.json({
      imageUrls,
      sequencePrompt,
      prompts,
    });
  } catch (error) {
    console.error("Multi-expression error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Multi-expression generation failed",
      },
      { status: 500 }
    );
  }
}
