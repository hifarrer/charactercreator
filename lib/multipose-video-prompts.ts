import {
  type CharacterBackground,
  type CharacterShotType,
  plainBackgroundNounPhrase,
} from "./character-framing";

export type VideoPromptKind = "pose" | "expression";

function buildSystemPose(background: CharacterBackground): string {
  const bg = plainBackgroundNounPhrase(background);
  return `You write short motion prompts for Alibaba Wan 2.6 image-to-video (3 second clips, single shot, silent video).
The input lists six still poses (Image 1 … Image 6). For each pose in order, write ONE concise English prompt describing motion and acting that fits that pose—subtle, natural, suitable for 3 seconds. Static camera. The character stays on a ${bg}; do not add scenery, props, or camera moves.

Respond with ONLY valid JSON, no markdown:
{"prompts":["prompt for pose 1","prompt for pose 2","prompt for pose 3","prompt for pose 4","prompt for pose 5","prompt for pose 6"]}

Each string should be one short phrase or sentence, present tense.`;
}

function buildSystemExpression(
  background: CharacterBackground,
  shotType: CharacterShotType
): string {
  const bg = plainBackgroundNounPhrase(background);
  const framing =
    shotType === "full_body"
      ? "six full-body expression stills (Image 1 … Image 6)—same body pose and framing, only the face changes"
      : "six front-shot expression stills (Image 1 … Image 6)—same body pose, only the face changes";
  return `You write short motion prompts for Alibaba Wan 2.6 image-to-video (3 second clips, single shot, silent video).
The input lists ${framing}. For each image in order, write ONE concise English prompt describing subtle FACIAL motion only: micro-expressions, blinking, mouth and eye movement that fits that emotion. The head angle, body, arms, and shoulders must stay completely still. Static camera. The character stays on a ${bg}; do not add scenery or props.

Respond with ONLY valid JSON, no markdown:
{"prompts":["prompt for clip 1","prompt for clip 2","prompt for clip 3","prompt for clip 4","prompt for clip 5","prompt for clip 6"]}

Each string should be one short phrase or sentence, present tense.`;
}

function fallbackMotion(
  kind: VideoPromptKind,
  background: CharacterBackground
): string {
  const bg = plainBackgroundNounPhrase(background);
  const tail = `static camera, ${bg} unchanged`;
  return kind === "expression"
    ? `subtle facial motion only, eyes and mouth animate slightly, head and body frozen still, ${tail}`
    : `subtle natural motion, character moves slightly, expression alive, ${tail}`;
}

export function defaultVideoPrompts(
  count: number,
  kind: VideoPromptKind = "pose",
  background: CharacterBackground = "black"
): string[] {
  return Array.from({ length: count }, () => fallbackMotion(kind, background));
}

export type GeneratePoseVideoPromptsOptions = {
  background?: CharacterBackground;
  shotType?: CharacterShotType;
};

export async function generatePoseVideoPrompts(
  sequencePrompt: string,
  characterContext: string,
  kind: VideoPromptKind = "pose",
  options?: GeneratePoseVideoPromptsOptions
): Promise<string[]> {
  const background = options?.background ?? "black";
  const shotType = options?.shotType ?? "front";

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return defaultVideoPrompts(6, kind, background);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const system =
    kind === "expression"
      ? buildSystemExpression(background, shotType)
      : buildSystemPose(background);

  const expressionFramingLabel =
    shotType === "full_body" ? "full body, same pose" : "front shot, same pose";
  const stillsBlock =
    kind === "expression"
      ? `Multi-expression still descriptions (${expressionFramingLabel}):\n${sequencePrompt.trim()}\n\nReturn the JSON with exactly 6 prompts.`
      : `Multi-pose still descriptions:\n${sequencePrompt.trim()}\n\nReturn the JSON with exactly 6 prompts.`;

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
              ? `Character context:\n${characterContext.trim()}\n\n`
              : "") + stillsBlock,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI video-prompt request failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  let content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return defaultVideoPrompts(6, kind, background);
  }

  if (content.startsWith("```")) {
    content = content.replace(/^```[\w]*\n?/, "").replace(/\n?```\s*$/, "");
  }

  const fb = fallbackMotion(kind, background);
  try {
    const parsed = JSON.parse(content) as { prompts?: unknown };
    if (!Array.isArray(parsed.prompts) || parsed.prompts.length < 6) {
      return defaultVideoPrompts(6, kind, background);
    }
    const rawList = parsed.prompts
      .slice(0, 6)
      .map((p) => (typeof p === "string" ? p.trim() : ""));
    return rawList.map((p) => (p.length > 0 ? p : fb));
  } catch {
    return defaultVideoPrompts(6, kind, background);
  }
}
