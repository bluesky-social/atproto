/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'

export const id = 'app.bsky.video.defs'

export interface JobStatus {
  $type?: $Type<'app.bsky.video.defs', 'jobStatus'>
  jobId: string
  did: string
  /** The state of the video processing job. All values not listed as a known value indicate that the job is in process. */
  state: 'JOB_STATE_COMPLETED' | 'JOB_STATE_FAILED' | (string & {})
  /** Progress within the current processing state. */
  progress?: number
  blob?: BlobRef
  error?: string
  message?: string
}

export function isJobStatus<V>(v: V) {
  return is$typed(v, id, 'jobStatus')
}

export function validateJobStatus(v: unknown) {
  return lexicons.validate(`${id}#jobStatus`, v) as ValidationResult<JobStatus>
}

export function isValidJobStatus<V>(v: V): v is V & $Typed<JobStatus> {
  return isJobStatus(v) && validateJobStatus(v).success
}
