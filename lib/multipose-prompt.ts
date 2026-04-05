import {
  type CharacterFraming,
  plainBackgroundNounPhrase,
} from "./character-framing";

function buildMultiPoseSystem(framing: CharacterFraming): string {
  const bgNoun = plainBackgroundNounPhrase(framing.background);
  const shotRules =
    framing.shotType === "full_body"
      ? `The reference uses FULL-BODY framing (entire figure visible). Every line must keep that same full-body scale and framing—do not crop to a bust or portrait; legs and feet stay in frame where applicable.`
      : `The reference uses FRONT / portrait-style framing (upper body or head-and-shoulders as in the source). Keep that same framing in every line—do not pull back to a distant full-body shot.`;

  return `You write prompts for an image model that takes ONE reference image of a character and generates exactly 6 new images in one batch. Each image is a different pose or expression.

Output format (exactly 6 lines, no other text before or after):
Image 1: character in a standing pose
Image 2: character laughing
Image 3: character surprised
Image 4: character crying
Image 5: character sad
Image 6: character happy

Rules:
- Use the same character (identity, outfit, proportions, art style) in every line.
- All 6 images use the same ${bgNoun} only—no scenery, environment, props, or gradients; body pose and expression may both vary across images (this is multi-pose, not expression-only).
- ${shotRules}
- Lines must be concise (one clause each).
- Do not add bullet points, markdown, or extra commentary.`;
}

export async function generateMultiPoseSequencePrompt(
  characterContext: string,
  framing: CharacterFraming
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const system = buildMultiPoseSystem(framing);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
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
