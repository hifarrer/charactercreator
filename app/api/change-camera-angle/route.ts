import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { changeCameraAngle } from "@/lib/wavespeed";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { imageUrl, horizontalAngle, verticalAngle, distance } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    let publicUrl = imageUrl;
    if (imageUrl.startsWith("/")) {
      const origin = request.headers.get("origin") || request.nextUrl.origin;
      publicUrl = `${origin}${imageUrl}`;
    }

    const result = await changeCameraAngle(
      publicUrl,
      horizontalAngle ?? 0,
      verticalAngle ?? 0,
      distance ?? 1
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Camera angle error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Camera angle change failed" },
      { status: 500 }
    );
  }
}
