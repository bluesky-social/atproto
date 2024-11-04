/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { isObj, hasProp } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import { CID } from 'multiformats/cid'
import * as AppBskyActorDefs from '../../../app/bsky/actor/defs'

export interface Member {
  did: string
  disabled?: boolean
  profile?: AppBskyActorDefs.ProfileViewDetailed
  createdAt?: string
  updatedAt?: string
  lastUpdatedBy?: string
  role:
    | 'lex:tools.ozone.team.defs#roleAdmin'
    | 'lex:tools.ozone.team.defs#roleModerator'
    | 'lex:tools.ozone.team.defs#roleTriage'
    | (string & {})
  [k: string]: unknown
}

export function isMember(v: unknown): v is Member {
  return (
    isObj(v) &&
    hasProp(v, '$type') &&
    v.$type === 'tools.ozone.team.defs#member'
  )
}

export function validateMember(v: unknown): ValidationResult {
  return lexicons.validate('tools.ozone.team.defs#member', v)
}

/** Admin role. Highest level of access, can perform all actions. */
export const ROLEADMIN = 'tools.ozone.team.defs#roleAdmin'
/** Moderator role. Can perform most actions. */
export const ROLEMODERATOR = 'tools.ozone.team.defs#roleModerator'
/** Triage role. Mostly intended for monitoring and escalating issues. */
export const ROLETRIAGE = 'tools.ozone.team.defs#roleTriage'
