/**
 * mockScene.ts
 * Generates plausible scene data from a concept + its neighbours.
 * Used when the backend hasn't generated a scene yet.
 * When the API is live, replace these generators with the fetched Scene JSON.
 */

import type { Challenge } from '@/components/scene/minigames/index'
import type { DialogueLine } from '@/components/scene/DialogueBox.vue'

// ─── Tiny seeded PRNG ─────────────────────────────────────────────────────────

function hash(str: string): number {
  let h = 0x811c9dc5
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193)
  return h >>> 0
}
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xffffffff }
}
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rng = makeRng(seed)
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type Archetype =
  | 'guardian-dialogue'
  | 'exploration-discovery'
  | 'environmental-puzzle'
  | 'memory-echo'
  | 'cooperative-challenge'

export interface ConceptLike {
  id: string
  title: string
  kind: string
  brief: string
  modelTier: string
}

// ─── Archetype selector ───────────────────────────────────────────────────────

const KIND_ARCHETYPES: Record<string, Archetype[]> = {
  definition: ['guardian-dialogue', 'memory-echo'],
  formula:    ['environmental-puzzle', 'guardian-dialogue'],
  example:    ['exploration-discovery', 'cooperative-challenge'],
  fact:       ['memory-echo', 'exploration-discovery'],
  principle:  ['guardian-dialogue', 'cooperative-challenge'],
  process:    ['environmental-puzzle', 'exploration-discovery'],
}

export function pickArchetype(concept: ConceptLike): Archetype {
  const options = KIND_ARCHETYPES[concept.kind] ?? ['guardian-dialogue']
  const idx = hash(concept.id) % options.length
  return options[idx]
}

// ─── Challenge selector ───────────────────────────────────────────────────────

const ARCHETYPE_CHALLENGES: Record<Archetype, Challenge['type'][]> = {
  'guardian-dialogue':     ['mcq', 'fill-blank', 'dialogue-choice'],
  'exploration-discovery': ['hotspot', 'match-pairs', 'drag-sort'],
  'environmental-puzzle':  ['drag-sort', 'fill-blank', 'timer'],
  'memory-echo':           ['mcq', 'match-pairs', 'dialogue-choice'],
  'cooperative-challenge': ['dialogue-choice', 'fill-blank', 'drag-sort'],
}

export function pickChallengeType(concept: ConceptLike, archetype: Archetype): Challenge['type'] {
  const options = ARCHETYPE_CHALLENGES[archetype]
  const idx = (hash(concept.id) >> 4) % options.length
  return options[idx]
}

// ─── Dialogue generators ──────────────────────────────────────────────────────

const OPENERS: Record<string, [string, DialogueLine['emotion']][]> = {
  definition: [
    ["Ah, a traveller seeking truth. Let me illuminate this for you.", 'neutral'],
    ["Words carry precise meanings here. This one matters.", 'stern'],
  ],
  formula:    [
    ["The universe speaks in mathematics. Listen closely.", 'thoughtful'],
    ["This formula took centuries to derive. You will grasp it in moments.", 'encouraging'],
  ],
  example:    [
    ["Theory is hollow without witness. I will show you this firsthand.", 'excited'],
    ["I once observed this very phenomenon. Walk with me.", 'neutral'],
  ],
  fact:       [
    ["Ha! Facts are my favourite cargo. Here is one worth keeping.", 'excited'],
    ["This took me years to confirm. Worth every expedition.", 'thoughtful'],
  ],
  principle:  [
    ["Principles are the bones beneath all knowledge. This one runs deep.", 'stern'],
    ["Grasp this principle and a dozen others will follow.", 'encouraging'],
  ],
  process:    [
    ["Every process has a heartbeat — a sequence that cannot be reversed.", 'neutral'],
    ["Step by step. That is how we navigate complexity.", 'thoughtful'],
  ],
}

export function generateDialogue(concept: ConceptLike): DialogueLine[] {
  const pairs  = OPENERS[concept.kind] ?? OPENERS['fact']
  const idx    = hash(concept.id) % pairs.length
  const [opener, emotion] = pairs[idx]
  return [
    { speaker: 'npc', text: opener,     emotion },
    { speaker: 'npc', text: concept.brief, emotion: 'thoughtful' },
    { speaker: 'npc', text: 'Now — demonstrate your understanding.', emotion: 'stern' },
  ]
}

// Shorter openers for non-dialogue archetypes
const ARCHETYPE_OPENINGS: Record<Archetype, (c: ConceptLike) => string> = {
  'guardian-dialogue':     (c) => `A guardian awaits with knowledge of ${c.title}.`,
  'exploration-discovery': (c) => `Explore this environment to uncover the secrets of ${c.title}.`,
  'environmental-puzzle':  (c) => `The environment reacts to ${c.title}. Solve it before the situation worsens.`,
  'memory-echo':           (c) => `An echo from the past replays a moment that defines ${c.title}.`,
  'cooperative-challenge': (c) => `Work with your companion to apply ${c.title} together.`,
}

export function getOpeningNarrative(concept: ConceptLike, archetype: Archetype): string {
  return ARCHETYPE_OPENINGS[archetype](concept)
}

// ─── Challenge generators ─────────────────────────────────────────────────────

export function generateChallenge(
  concept: ConceptLike,
  neighbours: ConceptLike[],
  type: Challenge['type'],
): Challenge {
  const seed = hash(concept.id)

  switch (type) {

    case 'mcq': {
      const distractors = seededShuffle(neighbours, seed).slice(0, 3)
      const opts = seededShuffle([
        { text: concept.brief, correct: true,  explanation: `Correct — ${concept.brief}` },
        ...distractors.map((d) => ({
          text: d.brief, correct: false,
          explanation: `This describes "${d.title}", not "${concept.title}".`,
        })),
      ], seed ^ 0x1234)
      return { type: 'mcq', question: `Which best describes "${concept.title}"?`, options: opts }
    }

    case 'drag-sort': {
      // Split brief into sentences, ask to reorder logically
      const sentences = concept.brief
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim().length > 10)
        .slice(0, 5)
      if (sentences.length < 2) {
        // Fallback: use concept + neighbour briefs as "steps"
        const items = [concept, ...seededShuffle(neighbours, seed).slice(0, 3)]
          .slice(0, 4)
          .map((c, i) => ({ id: c.id, label: c.title, correctIndex: i }))
        const shuffled = seededShuffle(items, seed ^ 0x5678)
          .map((item, i) => ({ ...item, displayIndex: i }))
        return {
          type: 'drag-sort',
          instruction: `Arrange these concepts in the order they logically build on each other.`,
          items: shuffled.map((item) => ({
            id: item.id, label: item.label, correctIndex: item.correctIndex,
          })),
        }
      }
      const shuffledSentences = seededShuffle(
        sentences.map((s, i) => ({ id: `s${i}`, label: s, correctIndex: i })),
        seed ^ 0x5678,
      )
      return {
        type: 'drag-sort',
        instruction: `Rearrange these parts of the definition into the correct order.`,
        items: shuffledSentences,
      }
    }

    case 'hotspot': {
      const targets = [concept, ...seededShuffle(neighbours, seed).slice(0, 3)].slice(0, 4)
      // Fixed grid positions
      const positions = [
        { x: 20, y: 30 }, { x: 65, y: 25 }, { x: 35, y: 65 }, { x: 72, y: 60 },
        { x: 50, y: 45 }, { x: 15, y: 60 },
      ]
      return {
        type: 'hotspot',
        instruction: `Discover all key concepts hidden in this environment.`,
        hotspots: targets.map((t, i) => ({
          id: t.id,
          label: t.title,
          x: positions[i % positions.length].x,
          y: positions[i % positions.length].y,
          revealText: t.brief,
          required: t.id === concept.id,
        })),
      }
    }

    case 'match-pairs': {
      const items = [concept, ...seededShuffle(neighbours, seed).slice(0, 3)].slice(0, 4)
      return {
        type: 'match-pairs',
        instruction: `Match each concept to its correct description.`,
        pairs: items.map((c) => ({ left: c.title, right: c.brief })),
      }
    }

    case 'fill-blank': {
      // Blank out the concept title from its brief
      const brief = concept.brief
      const title = concept.title
      const rng   = makeRng(seed)
      const distractors = seededShuffle(neighbours, seed)
        .slice(0, 3)
        .map((n) => n.title)
      const options = seededShuffle([title, ...distractors], seed ^ 0x9abc)

      if (brief.toLowerCase().includes(title.toLowerCase())) {
        const idx = brief.toLowerCase().indexOf(title.toLowerCase())
        return {
          type: 'fill-blank',
          instruction: `Complete the definition by filling in the missing term.`,
          segments: [
            { kind: 'text',  value: brief.slice(0, idx) },
            { kind: 'blank', id: 'b1', correctAnswer: title, alternatives: [], options },
            { kind: 'text',  value: brief.slice(idx + title.length) },
          ],
        }
      }

      // Fallback: full blank
      return {
        type: 'fill-blank',
        instruction: `Which term does this definition describe?`,
        segments: [
          { kind: 'blank', id: 'b1', correctAnswer: title, alternatives: [], options },
          { kind: 'text',  value: ` — ${brief}` },
        ],
      }
    }

    case 'timer': {
      const distractors = seededShuffle(neighbours, seed).slice(0, 3)
      const opts = seededShuffle([
        { text: concept.brief, correct: true },
        ...distractors.map((d) => ({ text: d.brief, correct: false })),
      ], seed ^ 0xdef0)
      const urgencyLines = [
        `The system is destabilising! Identify "${concept.title}" before it fails!`,
        `Containment breach! What is "${concept.title}"? Answer now!`,
        `Emergency protocol — confirm your understanding of "${concept.title}"!`,
      ]
      return {
        type: 'timer',
        urgencyNarrative: urgencyLines[hash(concept.id) % urgencyLines.length],
        timeSeconds: concept.modelTier === 'light' ? 20 : concept.modelTier === 'heavy' ? 35 : 25,
        question: `Which of these correctly describes "${concept.title}"?`,
        options: opts,
      }
    }

    case 'dialogue-choice': {
      const distractors = seededShuffle(neighbours, seed).slice(0, 2)
      return {
        type: 'dialogue-choice',
        setup: `Your companion turns to you with a question about ${concept.title}.`,
        exchanges: [
          {
            npcLine: `Tell me — how would you describe ${concept.title} to someone who had never encountered it?`,
            playerOptions: seededShuffle([
              {
                text: concept.brief,
                correct: true,
                npcReaction: 'Exactly right. You grasp it well.',
                emotion: 'encouraging' as const,
              },
              ...distractors.map((d) => ({
                text: d.brief,
                correct: false,
                npcReaction: `Hmm — that describes "${d.title}", not what I asked.`,
                emotion: 'stern' as const,
              })),
            ], seed ^ 0x7654),
          },
        ],
      }
    }

    default:
      // Exhaustive fallback — should never reach
      return generateChallenge(concept, neighbours, 'mcq')
  }
}
