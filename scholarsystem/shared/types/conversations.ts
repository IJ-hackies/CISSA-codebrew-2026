import { z } from "zod";
import { Slug } from "./ids";

// In-scene player ↔ chatbot conversations. Reserved scope — not yet
// produced by any pipeline stage. Lives in its own scope (not nested
// under `scenes` or `progress`) so the existing mutability contracts
// stay clean: `scenes` remains append-only, `progress` stays lean, and
// `conversations` gets its own append-only-turns contract.
//
// Keyed by body id (moon/asteroid = concept anchor). One conversation
// per body; turns are appended as the user talks to in-scene NPCs.
//
// Declared now so existing blobs forward-parse (`conversations` starts
// `{}`) without needing a schema version bump later when chat lands.

export const ConversationRole = z.enum(["user", "assistant"]);

export const ConversationTurn = z.object({
  role: ConversationRole,
  // For assistant turns, the character id from narrative.recurringCharacters
  // whose voice this turn was generated in. null for user turns and for
  // narrator/environmental assistant text.
  speakerId: Slug.nullable(),
  text: z.string(),
  at: z.number().int(),
});

export const BodyConversation = z.object({
  bodyId: Slug,
  turns: z.array(ConversationTurn),
});

// Keyed by body id. Missing keys are valid — a body with no conversation
// yet simply has no entry.
export const Conversations = z.record(Slug, BodyConversation);

export type ConversationRole = z.infer<typeof ConversationRole>;
export type ConversationTurn = z.infer<typeof ConversationTurn>;
export type BodyConversation = z.infer<typeof BodyConversation>;
export type Conversations = z.infer<typeof Conversations>;
