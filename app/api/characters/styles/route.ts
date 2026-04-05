import { NextResponse } from "next/server";
import stylesData from "@/characters.json";

const NO_STYLE = {
  style_name: "No style",
  model: "alibaba/wan-2.5/text-to-image",
  thumbnail_image: "https://neonvideo.b-cdn.net/characterpublic/no_style.jpg",
  prompt_enhancer: null,
};

export async function GET() {
  const styles = [NO_STYLE, ...stylesData];
  return NextResponse.json(styles);
}
