import { NextRequest, NextResponse } from "next/server";
import { validateToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { name, prompt, imageUrl } = body;

    if (!name || !prompt || !imageUrl) {
      return NextResponse.json(
        { error: "name, prompt, and imageUrl are required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const stmt = db.prepare(
      "INSERT INTO saved_characters (name, prompt, image_url) VALUES (?, ?, ?)"
    );
    const result = stmt.run(name, prompt, imageUrl);

    const saved = db
      .prepare("SELECT * FROM saved_characters WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("Save character error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const authError = validateToken(request);
  if (authError) return authError;

  try {
    const db = getDb();
    const characters = db
      .prepare("SELECT * FROM saved_characters ORDER BY created_at DESC")
      .all();

    return NextResponse.json(characters);
  } catch (error) {
    console.error("List characters error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list characters" },
      { status: 500 }
    );
  }
}
