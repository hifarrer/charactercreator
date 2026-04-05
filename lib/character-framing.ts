export const CHARACTER_BACKGROUNDS = ["black", "white"] as const;
export type CharacterBackground = (typeof CHARACTER_BACKGROUNDS)[number];

export const CHARACTER_SHOT_TYPES = ["front", "full_body"] as const;
export type CharacterShotType = (typeof CHARACTER_SHOT_TYPES)[number];

export type CharacterFraming = {
  background: CharacterBackground;
  shotType: CharacterShotType;
};

export const CHARACTER_BACKGROUND_LABELS: Record<CharacterBackground, string> = {
  black: "Black",
  white: "White",
};

export const CHARACTER_SHOT_TYPE_LABELS: Record<CharacterShotType, string> = {
  front: "Front shot",
  full_body: "Full body shot",
};

export const DEFAULT_CHARACTER_FRAMING: CharacterFraming = {
  background: "black",
  shotType: "front",
};

/** e.g. "plain solid black background" (for prose inside OpenAI system prompts). */
export function plainBackgroundNounPhrase(
  background: CharacterBackground
): string {
  return background === "white"
    ? "plain solid white background"
    : "plain solid black background";
}

/** Instruction appended to text-to-image / image-to-image character prompts. */
export function plainBackgroundInstruction(background: CharacterBackground): string {
  const color = background === "white" ? "white" : "black";
  return `plain solid ${color} background, character only, no scenery, no environment, no props, isolated subject`;
}

export function shotTypePrefix(shotType: CharacterShotType): string {
  return shotType === "full_body"
    ? "front shot, full body shot of a"
    : "front shot of a";
}

export function buildCharacterImagePrompt(
  subjectDescription: string,
  promptEnhancer: string | null,
  framing: CharacterFraming
): string {
  const shot = shotTypePrefix(framing.shotType);
  const bg = plainBackgroundInstruction(framing.background);
  return promptEnhancer
    ? `${shot} ${subjectDescription}, ${promptEnhancer}, ${bg}`
    : `${shot} ${subjectDescription}, ${bg}`;
}

export function parseCharacterBackground(value: unknown): CharacterBackground {
  return value === "white" ? "white" : "black";
}

export function parseCharacterShotType(value: unknown): CharacterShotType {
  return value === "full_body" ? "full_body" : "front";
}

export function parseCharacterFraming(body: {
  background?: unknown;
  shotType?: unknown;
}): CharacterFraming {
  return {
    background: parseCharacterBackground(body.background),
    shotType: parseCharacterShotType(body.shotType),
  };
}

/** Phrase for multi-image API wrappers (Seedream sequential, etc.). */
export function identicalPlainBackgroundPhrase(
  background: CharacterBackground
): string {
  return `identical ${plainBackgroundNounPhrase(background)}`;
}
