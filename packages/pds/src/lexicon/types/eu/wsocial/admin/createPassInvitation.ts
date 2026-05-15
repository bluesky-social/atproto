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
const id = 'eu.wsocial.admin.createPassInvitation'

export type QueryParams = {}

export interface InputSchema {
  /** Email address of the invited user. */
  email: string
  /** Suggested handle for the new account (optional). */
  preferredHandle?: string
}

export interface OutputSchema {
  email: string
  /** The generated atproto invite code. */
  inviteCode: string
  /** Onboarding URL with inviteCode, email and handle pre-baked as query params. */
  onboardingUrl: string
  preferredHandle?: string
  /** ISO timestamp when the invitation expires (30 days). */
  expiresAt: string
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
  error?: 'InvitationConfigError' | 'InviteCodeGenerationError'
}

export type HandlerOutput = HandlerError | HandlerSuccess
