import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { validatePrompt } from "@/lib/profanity-filter";
import { generateImage } from "@/lib/wavespeed";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { prompt, aspectRatio, style, model, promptEnhancer } = body;

    if (!prompt || !model) {
      return NextResponse.json(
        { error: "prompt and model are required" },
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

    const result = await generateImage(
      prompt,
      aspectRatio || "1:1",
      style || "No style",
      model,
      promptEnhancer || null
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Generate options error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
