/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'

export interface JobStatus {
  jobId: string
  did: string
  /** The state of the video processing job. All values not listed as a known value indicate that the job is in process. */
  state: 'JOB_STATE_COMPLETED' | 'JOB_STATE_FAILED' | (string & {})
  /** Progress within the current processing state. */
  progress?: number
  blob?: BlobRef
  error?: string
  message?: string
  [k: string]: unknown
}

export function isJobStatus(v: unknown): v is JobStatus {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'app.bsky.video.defs#jobStatus'
  )
}

export function validateJobStatus(v: unknown): ValidationResult {
  return lexicons.validate('app.bsky.video.defs#jobStatus', v)
}
