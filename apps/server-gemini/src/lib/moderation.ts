// Content moderation using Gemini Flash.
// Used before publishing a galaxy to the Taco gallery.

import { generateText, MODEL_FLASH } from "../pipeline/gemini";

export interface ModerationResult {
  pass: boolean;
  reason?: string;
}

const SYSTEM_INSTRUCTION = `You are a content moderation assistant.
Your job is to determine if text is appropriate for a public community gallery.
Reject content that contains: racism, sexism, homophobia, transphobia, slurs, hate speech,
explicit sexual content, graphic violence, or harassment.
Respond with exactly one of:
  PASS
  FAIL: <short reason>
Nothing else.`;

/**
 * Check a galaxy title + tagline for inappropriate content before publishing.
 * Returns { pass: true } if safe, or { pass: false, reason } if not.
 */
export async function moderateGalleryContent(
  title: string,
  tagline: string,
): Promise<ModerationResult> {
  const prompt = `Title: ${title.slice(0, 200)}\nTagline: ${tagline.slice(0, 500)}`;

  let response: string;
  try {
    response = await generateText({
      model: MODEL_FLASH,
      parts: [{ text: prompt }],
      systemInstruction: SYSTEM_INSTRUCTION,
      maxOutputTokens: 64,
      thinkingBudget: 0,
    });
  } catch (err) {
    // On moderation API failure, fail open (allow publish) with a warning.
    console.warn("[moderation] Gemini call failed, failing open:", err);
    return { pass: true };
  }

  const trimmed = response.trim();
  if (trimmed.startsWith("FAIL")) {
    const reason = trimmed.replace(/^FAIL:\s*/i, "").trim() || "Content policy violation";
    return { pass: false, reason };
  }
  return { pass: true };
}
