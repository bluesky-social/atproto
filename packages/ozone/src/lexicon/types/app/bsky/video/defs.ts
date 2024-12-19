/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import {
  isValid as _isValid,
  validate as _validate,
} from '../../../../lexicons'
import { $Type, $Typed, is$typed as _is$typed, OmitKey } from '../../../../util'

const is$typed = _is$typed,
  isValid = _isValid,
  validate = _validate
const id = 'app.bsky.video.defs'

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

const hashJobStatus = 'jobStatus'

export function isJobStatus<V>(v: V) {
  return is$typed(v, id, hashJobStatus)
}

export function validateJobStatus<V>(v: V) {
  return validate<JobStatus & V>(v, id, hashJobStatus)
}

export function isValidJobStatus<V>(v: V) {
  return isValid<JobStatus>(v, id, hashJobStatus)
}
