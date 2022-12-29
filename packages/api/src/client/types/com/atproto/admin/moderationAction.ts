/**
 * GENERATED CODE - DO NOT MODIFY
 */
export interface View {
  id: number
  action: 'com.atproto.admin.moderationAction#takedown' | (string & {})
  subject: SubjectRepo | { $type: string; [k: string]: unknown }
  reason: string
  createdBy: string
  createdAt: string
  reversal?: Reversal
  [k: string]: unknown
}

export interface Reversal {
  reason: string
  createdBy: string
  createdAt: string
  [k: string]: unknown
}

export interface SubjectRepo {
  did: string
  [k: string]: unknown
}

/** Moderation action type: Takedown. */
export const TAKEDOWN = 'com.atproto.admin.moderationAction#takedown'
