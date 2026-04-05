const SYSTEM = `You write prompts for an image model that takes ONE reference image of a character and generates exactly 6 new images in one batch. Each image is a different pose or expression.

Output format (exactly 6 lines, no other text before or after):
Image 1: <short pose/expression description>
Image 2: <short pose/expression description>
Image 3: <short pose/expression description>
Image 4: <short pose/expression description>
Image 5: <short pose/expression description>
Image 6: <short pose/expression description>

Rules:
- Use the same character (identity, outfit, proportions, art style) in every line.
- Keep the SAME background, environment, and lighting in all 6 images; only the character's pose and expression change.
- Lines must be concise (one clause each).
- Do not add bullet points, markdown, or extra commentary.`;

export async function generateMultiPoseSequencePrompt(
  characterContext: string
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content:
            (characterContext.trim()
              ? `Character / scene context:\n${characterContext.trim()}\n\n`
              : "") + "Generate the 6-line multi-pose prompt now.",
        },
      ],
      temperature: 0.75,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  let content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  if (content.startsWith("```")) {
    content = content.replace(/^```[\w]*\n?/, "").replace(/\n?```\s*$/, "");
  }

  return content.trim();
}
