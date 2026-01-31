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
const id = 'com.atproto.admin.migrateAccount'

export type QueryParams = {}

export interface InputSchema {
  /** DID of account to migrate */
  did: string
  /** URL of destination PDS (e.g., https://pds2.wsocial.eu) */
  targetPdsUrl: string
  /** Optional: New handle on target PDS (default: keep existing) */
  targetHandle?: string
  /** If true, don't deactivate account on source PDS after migration */
  skipDeactivation?: boolean
}

export interface OutputSchema {
  did: string
  /** Source PDS hostname */
  sourcePds: string
  /** Target PDS URL */
  targetPds: string
  /** Migration status: completed, partial, failed */
  status: string
  migratedAt: string
  details?: MigrationDetails
}

export interface HandlerInput {
  encoding: 'application/json'
  body: InputSchema
}

export interface HandlerSuccess {
  encoding: 'application/json'
  body: OutputSchema
  headers?: { [key: string]: string }
}

export interface HandlerError {
  status: number
  message?: string
  error?: 'AccountNotFound' | 'InvalidTargetPds' | 'MigrationFailed'
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface MigrationDetails {
  $type?: 'com.atproto.admin.migrateAccount#migrationDetails'
  /** Number of repo blocks migrated */
  repoBlocks?: number
  /** Number of blobs successfully transferred */
  blobsTransferred?: number
  /** Number of blobs that failed to transfer */
  blobsFailed?: number
  /** Whether W ID link was migrated */
  neuroLinkMigrated?: boolean
  /** Number of app passwords migrated */
  appPasswordsMigrated?: number
  errors?: string[]
}

const hashMigrationDetails = 'migrationDetails'

export function isMigrationDetails<V>(v: V) {
  return is$typed(v, id, hashMigrationDetails)
}

export function validateMigrationDetails<V>(v: V) {
  return validate<MigrationDetails & V>(v, id, hashMigrationDetails)
}
