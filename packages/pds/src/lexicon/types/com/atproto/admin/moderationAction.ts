/**
 * GENERATED CODE - DO NOT MODIFY
 */
export interface View {
  id: number
  action: 'com.atproto.admin.moderationAction#takedown' | (string & {})
  subject:
    | SubjectRepo
    | SubjectRecordRef
    | { $type: string; [k: string]: unknown }
  reason: string
  createdBy: string
  createdAt: string
  reversal?: Reversal
  resolvedReports: ResolvedReport[]
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

export interface SubjectRecord {
  /** The DID of the repo. */
  did: string
  /** The NSID of the collection. */
  collection: string
  /** The key of the record. */
  rkey: string
  /** The CID of the version of the record. If not specified, defaults to the most recent version. */
  cid?: string
  [k: string]: unknown
}

export interface SubjectRecordRef {
  uri: string
  cid: string
  [k: string]: unknown
}

export interface ResolvedReport {
  id: number
  [k: string]: unknown
}

/** Moderation action type: Takedown. Indicates that content should not be served by the PDS. */
export const TAKEDOWN = 'com.atproto.admin.moderationAction#takedown'
/** Moderation action type: Flag. Indicates that the content was reviewed and considered to violate PDS rules, but may still be served. */
export const FLAG = 'com.atproto.admin.moderationAction#flag'
/** Moderation action type: Acknowledge. Indicates that the content was reviewed and not considered to violate PDS rules. */
export const ACKNOWLEDGE = 'com.atproto.admin.moderationAction#acknowledge'
