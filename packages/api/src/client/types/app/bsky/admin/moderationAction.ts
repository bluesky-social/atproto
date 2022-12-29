/**
 * GENERATED CODE - DO NOT MODIFY
 */
export interface View {
  id: number
  action: 'app.bsky.admin.moderationAction#takedown' | (string & {})
  subject: SubjectActor | { $type: string; [k: string]: unknown }
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

export interface SubjectActor {
  did: string
  [k: string]: unknown
}

/** Moderation action type: Takedown. */
export const TAKEDOWN = 'app.bsky.admin.moderationAction#takedown'
