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
import type * as ChatBskyActorDefs from '../actor/defs.js'
import type * as ChatBskyConvoDefs from '../convo/defs.js'

const is$typed = _is$typed,
  validate = _validate
const id = 'chat.bsky.group.defs'

export type LinkEnabledStatus = 'enabled' | 'disabled' | (string & {})
export type JoinRule = 'anyone' | 'followedByOwner' | (string & {})

export interface JoinLinkView {
  $type?: 'chat.bsky.group.defs#joinLinkView'
  code: string
  enabledStatus: LinkEnabledStatus
  requireApproval: boolean
  joinRule: JoinRule
  createdAt: string
}

const hashJoinLinkView = 'joinLinkView'

export function isJoinLinkView<V>(v: V) {
  return is$typed(v, id, hashJoinLinkView)
}

export function validateJoinLinkView<V>(v: V) {
  return validate<JoinLinkView & V>(v, id, hashJoinLinkView)
}

export interface JoinLinkPreviewView {
  $type?: 'chat.bsky.group.defs#joinLinkPreviewView'
  name: string
  owner: ChatBskyActorDefs.ProfileViewBasic
  memberCount: number
  requireApproval: boolean
  convo?: ChatBskyConvoDefs.ConvoView
}

const hashJoinLinkPreviewView = 'joinLinkPreviewView'

export function isJoinLinkPreviewView<V>(v: V) {
  return is$typed(v, id, hashJoinLinkPreviewView)
}

export function validateJoinLinkPreviewView<V>(v: V) {
  return validate<JoinLinkPreviewView & V>(v, id, hashJoinLinkPreviewView)
}

export interface JoinRequestView {
  $type?: 'chat.bsky.group.defs#joinRequestView'
  convoId: string
  requestedBy: ChatBskyActorDefs.ProfileViewBasic
  requestedAt: string
}

const hashJoinRequestView = 'joinRequestView'

export function isJoinRequestView<V>(v: V) {
  return is$typed(v, id, hashJoinRequestView)
}

export function validateJoinRequestView<V>(v: V) {
  return validate<JoinRequestView & V>(v, id, hashJoinRequestView)
}
