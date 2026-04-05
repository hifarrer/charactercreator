import { NextRequest, NextResponse } from "next/server";

export function validateToken(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  if (token !== process.env.API_TOKEN) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  return null;
}
