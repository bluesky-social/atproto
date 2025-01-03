/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { lexicons } from '../../../../lexicons'
import { $Type, is$typed } from '../../../../util'

const id = 'app.bsky.video.defs'

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

export function isJobStatus(
  v: unknown,
): v is JobStatus & { $type: $Type<'app.bsky.video.defs', 'jobStatus'> } {
  return is$typed(v, id, 'jobStatus')
}

export function validateJobStatus(v: unknown) {
  return lexicons.validate(`${id}#jobStatus`, v) as ValidationResult<JobStatus>
}
