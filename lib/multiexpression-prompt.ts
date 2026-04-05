import {
  type CharacterFraming,
  plainBackgroundNounPhrase,
} from "./character-framing";

function buildMultiExpressionSystem(framing: CharacterFraming): string {
  const bgNoun = plainBackgroundNounPhrase(framing.background);
  const shotBlock =
    framing.shotType === "full_body"
      ? `The reference may show the full body. Preserve the same full-body framing, camera distance, and crop—only the face changes.`
      : `The reference uses front / portrait-style framing. Preserve that same framing and crop—only the face changes.`;

  return `You write image-to-image edit prompts for Google Nano Banana (one reference image per request).

Each of the 6 strings in the JSON will be sent alone as the \`prompt\` for a separate API call. Every call uses the SAME reference image of a character.

Requirements for EVERY string:
- Instruct the model to change ONLY the character's facial expression (eyes, brows, mouth, subtle emotion). Identity, outfit, hair, body pose, head angle, and art style must stay the same.
- Explicitly say to leave the background unchanged—the reference has a ${bgNoun}; no new scenery, props, or color shifts.
- Explicitly say to keep the same camera framing and zoom—no crop change, no camera move.
- ${shotBlock}
- Keep the same idle / neutral body pose; do not turn the head or lean the body for emphasis.
- Phrase each as a direct edit instruction (e.g. "Change the character expression to …") and include "do not change anything else" or equivalent, scoped to face-only.
- Short and clear; one or two sentences per string.

Respond with ONLY valid JSON (no markdown fences):
{"prompts":["prompt for image 1","prompt for image 2","prompt for image 3","prompt for image 4","prompt for image 5","prompt for image 6"]}

The array MUST have exactly 6 strings in order: typically smiling, laughing, surprised, terrified, angry, sad—or emotions that fit the character context if the user described a specific personality.`;
}

function defaultExpressionPrompts(framing: CharacterFraming): string[] {
  const bg =
    framing.background === "white"
      ? "Leave the plain solid white background unchanged."
      : "Leave the plain solid black background unchanged.";
  const cam =
    framing.shotType === "full_body"
      ? "Keep the same full-body framing, camera distance, and zoom."
      : "Keep the same camera framing and zoom.";
  const suffix = `${bg} ${cam} Alter only facial expression.`;

  return [
    `Change the character expression to smiling; do not change anything else—only the face expression. ${suffix}`,
    `Change the character expression to laughing; do not change anything else—only the face expression. ${suffix}`,
    `Change the character expression to surprised; do not change anything else—only the face expression. ${suffix}`,
    `Change the character expression to terrified; do not change anything else—only the face expression. ${suffix}`,
    `Change the character expression to angry; do not change anything else—only the face expression. ${suffix}`,
    `Change the character expression to sad; do not change anything else—only the face expression. ${suffix}`,
  ];
}

function buildSequencePrompt(prompts: string[]): string {
  return prompts.map((p, i) => `Image ${i + 1}: ${p}`).join("\n");
}

function normalizePrompts(raw: unknown): string[] | null {
  if (!raw || typeof raw !== "object") return null;
  const prompts = (raw as { prompts?: unknown }).prompts;
  if (!Array.isArray(prompts) || prompts.length < 6) return null;
  const out = prompts
    .slice(0, 6)
    .map((p) => (typeof p === "string" ? p.trim() : ""));
  if (out.some((p) => !p)) return null;
  return out;
}

export type MultiExpressionPromptsResult = {
  prompts: string[];
  sequencePrompt: string;
};

export async function generateMultiExpressionImagePrompts(
  characterContext: string,
  framing: CharacterFraming
): Promise<MultiExpressionPromptsResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const prompts = defaultExpressionPrompts(framing);
    return {
      prompts,
      sequencePrompt: buildSequencePrompt(prompts),
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const system = buildMultiExpressionSystem(framing);

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
              : "") +
            "Return the JSON with exactly 6 image-to-image prompts as specified (expression-only edits, same reference image each time).",
        },
      ],
      temperature: 0.75,
      response_format: { type: "json_object" },
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
    const prompts = defaultExpressionPrompts(framing);
    return {
      prompts,
      sequencePrompt: buildSequencePrompt(prompts),
    };
  }

  if (content.startsWith("```")) {
    content = content.replace(/^```[\w]*\n?/, "").replace(/\n?```\s*$/, "");
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    const prompts = normalizePrompts(parsed);
    if (prompts) {
      return {
        prompts,
        sequencePrompt: buildSequencePrompt(prompts),
      };
    }
  } catch {
    // fall through to defaults
  }

  const prompts = defaultExpressionPrompts(framing);
  return {
    prompts,
    sequencePrompt: buildSequencePrompt(prompts),
  };
}
