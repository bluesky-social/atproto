/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { $Type, $Typed, is$typed, OmitKey } from '../../../../util'
import { lexicons } from '../../../../lexicons'
import * as AppBskyActorDefs from '../../../app/bsky/actor/defs'

export const id = 'tools.ozone.team.defs'

export interface Member {
  $type?: $Type<'tools.ozone.team.defs', 'member'>
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
}

export function isMember<V>(v: V) {
  return is$typed(v, id, 'member')
}

export function validateMember(v: unknown) {
  return lexicons.validate(`${id}#member`, v) as ValidationResult<Member>
}

export function isValidMember<V>(v: V): v is V & $Typed<Member> {
  return isMember(v) && validateMember(v).success
}

/** Admin role. Highest level of access, can perform all actions. */
export const ROLEADMIN = `${id}#roleAdmin`
/** Moderator role. Can perform most actions. */
export const ROLEMODERATOR = `${id}#roleModerator`
/** Triage role. Mostly intended for monitoring and escalating issues. */
export const ROLETRIAGE = `${id}#roleTriage`
