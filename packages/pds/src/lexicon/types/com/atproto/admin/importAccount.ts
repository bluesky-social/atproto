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
const id = 'com.atproto.admin.importAccount'

export type QueryParams = {}

export interface InputSchema {
  did: string
  /** Account handle */
  handle: string
  /** Account email (optional for Neuro accounts) */
  email?: string
  /** Whether email was confirmed on source PDS */
  emailConfirmed?: boolean
  neuroLink?: NeuroLinkData
  /** App passwords to restore (preserves third-party client access) */
  appPasswords?: AppPasswordItem[]
}

export interface OutputSchema {
  did: string
  importStatus?: ImportStatusData
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
  error?: 'AccountExists' | 'DuplicateNeuroId' | 'HandleTaken'
}

export type HandlerOutput = HandlerError | HandlerSuccess

export interface NeuroLinkData {
  $type?: 'com.atproto.admin.importAccount#neuroLinkData'
  /** Neuro Legal ID (W ID) in format: uuid@legal.domain */
  legalId: string
  /** When the link was originally created */
  linkedAt?: string
  /** Last Neuro authentication time */
  lastLoginAt?: string
}

const hashNeuroLinkData = 'neuroLinkData'

export function isNeuroLinkData<V>(v: V) {
  return is$typed(v, id, hashNeuroLinkData)
}

export function validateNeuroLinkData<V>(v: V) {
  return validate<NeuroLinkData & V>(v, id, hashNeuroLinkData)
}

export interface AppPasswordItem {
  $type?: 'com.atproto.admin.importAccount#appPasswordItem'
  /** App password name */
  name: string
  /** Scrypt hash of app password */
  passwordScrypt: string
  /** Whether app password has privileged access */
  privileged?: boolean
  createdAt: string
}

const hashAppPasswordItem = 'appPasswordItem'

export function isAppPasswordItem<V>(v: V) {
  return is$typed(v, id, hashAppPasswordItem)
}

export function validateAppPasswordItem<V>(v: V) {
  return validate<AppPasswordItem & V>(v, id, hashAppPasswordItem)
}

export interface ImportStatusData {
  $type?: 'com.atproto.admin.importAccount#importStatusData'
  /** Whether account was created successfully */
  accountCreated?: boolean
  /** Whether W ID link was restored */
  neuroLinkRestored?: boolean
  /** Number of app passwords restored */
  appPasswordsRestored?: number
}

const hashImportStatusData = 'importStatusData'

export function isImportStatusData<V>(v: V) {
  return is$typed(v, id, hashImportStatusData)
}

export function validateImportStatusData<V>(v: V) {
  return validate<ImportStatusData & V>(v, id, hashImportStatusData)
}
