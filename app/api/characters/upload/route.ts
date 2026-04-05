import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 5MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let processedBuffer: Buffer;
    try {
      processedBuffer = await sharp(buffer)
        .resize(1024, 1024, { fit: "cover" })
        .jpeg({ quality: 90 })
        .toBuffer();
    } catch {
      processedBuffer = buffer;
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });

    const filename = `character_${nanoid()}.jpg`;
    const filepath = path.join(uploadsDir, filename);
    await fs.writeFile(filepath, processedBuffer);

    return NextResponse.json({ imageUrl: `/uploads/${filename}` });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
