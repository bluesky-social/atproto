/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../../lexicons'
import {
  type $Typed,
  is$typed as _is$typed,
  type OmitKey,
} from '../../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'com.atproto.unspecced.getActorStoreMigrationStatus'

export type QueryParams = {}
export type InputSchema = undefined

export interface OutputSchema {
  /** Whether all actor stores have been migrated to the latest schema version. */
  allMigrated: boolean
  /** The number of actor store migrations currently in progress. */
  inProgressCount: number
  /** The number of actors on each schema version. */
  versionCounts: VersionCount[]
}

export type HandlerInput = void

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface VersionCount {
  $type?: 'com.atproto.unspecced.getActorStoreMigrationStatus#versionCount'
  version: string
  count: number
}

const hashVersionCount = 'versionCount'

export function isVersionCount<V>(v: V) {
  return is$typed(v, id, hashVersionCount)
}

export function validateVersionCount<V>(v: V) {
  return validate<VersionCount & V>(v, id, hashVersionCount)
}
