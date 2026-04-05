import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";

export const maxDuration = 300;

const FFMPEG_CONVERT_URL =
  "https://www.ffmpegapi.net/api/convert_video_to_gif";

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  const apiKey = process.env.FFMPEG_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FFMPEG_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { video_url } = body as { video_url?: string };

    if (!video_url || typeof video_url !== "string") {
      return NextResponse.json(
        { error: "video_url is required" },
        { status: 400 }
      );
    }

    const upstream = await fetch(FFMPEG_CONVERT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ video_url }),
    });

    const data = (await upstream.json().catch(() => ({}))) as {
      success?: boolean;
      download_url?: string;
      filename?: string;
      message?: string;
      error?: string;
    };

    if (!upstream.ok) {
      return NextResponse.json(
        {
          error:
            data.error ||
            `FFmpeg API request failed (${upstream.status})`,
        },
        { status: 502 }
      );
    }

    if (!data.success || !data.download_url) {
      return NextResponse.json(
        { error: data.error || "GIF conversion failed" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      download_url: data.download_url,
      filename: data.filename,
      message: data.message,
    });
  } catch (error) {
    console.error("convert-video-to-gif error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "GIF conversion failed",
      },
      { status: 500 }
    );
  }
}
