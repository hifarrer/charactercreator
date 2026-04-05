const BLOCKED_TERMS = [
  "nsfw",
  "nude",
  "naked",
  "pornographic",
  "explicit",
  "xxx",
  "sexual",
  "genitalia",
  "erotic",
];

export function validatePrompt(
  prompt: string,
  promptEnhancer?: string | null
): { valid: boolean; reason?: string } {
  const combined = `${prompt} ${promptEnhancer || ""}`.toLowerCase();

  for (const term of BLOCKED_TERMS) {
    if (combined.includes(term)) {
      return {
        valid: false,
        reason: `Prompt contains prohibited content: "${term}"`,
      };
    }
  }

  return { valid: true };
}
