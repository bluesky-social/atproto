/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as AppBskyActorRef from '../actor/ref'

export interface View {
  id: number
  action: 'app.bsky.admin.actionTakedown' | (string & {})
  subject: AppBskyActorRef.Main | { $type: string; [k: string]: unknown }
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
