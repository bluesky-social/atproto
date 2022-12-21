/**
 * GENERATED CODE - DO NOT MODIFY
 */
import * as AppBskyActorRef from '../actor/ref'

export interface View {
  id: number
  action: 'takedown' | (string & {})
  subject: AppBskyActorRef.Main | { $type: string; [k: string]: unknown }
  rationale: string
  createdBy: string
  createdAt: string
  reversedBy?: string
  reversedAt?: string
  reversedRationale?: string
  [k: string]: unknown
}
