export { default as MCQChallenge } from './MCQChallenge.vue'
export { default as DragSort } from './DragSort.vue'
export { default as HotspotScene } from './HotspotScene.vue'
export { default as MatchPairs } from './MatchPairs.vue'
export { default as FillBlank } from './FillBlank.vue'
export { default as TimerChallenge } from './TimerChallenge.vue'
export { default as DialogueChoiceChallenge } from './DialogueChoiceChallenge.vue'

export type { MCQChallengeData, MCQOption } from './MCQChallenge.vue'
export type { DragSortChallenge, DragSortItem } from './DragSort.vue'
export type { HotspotChallenge, Hotspot } from './HotspotScene.vue'
export type { MatchPairsChallenge } from './MatchPairs.vue'
export type { FillBlankChallenge, Segment } from './FillBlank.vue'
export type { TimerChallengeData } from './TimerChallenge.vue'
export type { DialogueChoiceChallengeData, Exchange, PlayerOption } from './DialogueChoiceChallenge.vue'

/** Union of all challenge types — discriminated on `type`. */
export type Challenge =
  | import('./DragSort.vue').DragSortChallenge
  | import('./HotspotScene.vue').HotspotChallenge
  | import('./MatchPairs.vue').MatchPairsChallenge
  | import('./FillBlank.vue').FillBlankChallenge
  | import('./TimerChallenge.vue').TimerChallengeData
  | import('./DialogueChoiceChallenge.vue').DialogueChoiceChallengeData
  | import('./MCQChallenge.vue').MCQChallengeData
