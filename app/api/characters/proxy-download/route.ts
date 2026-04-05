import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";

function isAllowedFfmpegDownloadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "ffmpegapi.net" || h.endsWith(".ffmpegapi.net");
  } catch {
    return false;
  }
}

function filenameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop() ?? "";
    const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_");
    if (safe.toLowerCase().endsWith(".gif")) return safe;
    return safe ? `${safe}.gif` : "character.gif";
  } catch {
    return "character.gif";
  }
}

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!isAllowedFfmpegDownloadUrl(target)) {
    return NextResponse.json({ error: "URL not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target, { redirect: "follow" });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `File fetch failed (${upstream.status})` },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get("content-type") || "image/gif";
    const buf = await upstream.arrayBuffer();
    const filename = filenameFromUrl(target);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("proxy-download error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Download proxy failed",
      },
      { status: 500 }
    );
  }
}
