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
const id = 'com.atproto.admin.createIdentityProvider'

export type QueryParams = {}

export interface InputSchema {
  id: string
  name?: string
  icon?: string
  issuer: string
  clientId: string
  clientSecret?: string
  scope: string
  usePkce: boolean
  discoverable: boolean
  metadata?: Metadata
}

export interface OutputSchema {
  idpId: string
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
  error?:
    | 'IdentityProviderAlreadyExists'
    | 'IndiscoverableMetadata'
    | 'IssuerMismatch'
    | 'InsecureTransport'
    | 'PublicWithoutPkce'
}

export type HandlerOutput = HandlerError | HandlerSuccess
export type AuthMethod =
  | 'client_secret_basic'
  | 'client_secret_post'
  | (string & {})
export type CodeChallengeMethod = 'plain' | 'S256' | (string & {})

export interface Endpoints {
  $type?: 'com.atproto.admin.createIdentityProvider#endpoints'
  authorization: string
  token: string
  userinfo?: string
}

const hashEndpoints = 'endpoints'

export function isEndpoints<V>(v: V) {
  return is$typed(v, id, hashEndpoints)
}

export function validateEndpoints<V>(v: V) {
  return validate<Endpoints & V>(v, id, hashEndpoints)
}

export interface Mappings {
  $type?: 'com.atproto.admin.createIdentityProvider#mappings'
  sub: string
  username?: string
  picture?: string
  email?: string
}

const hashMappings = 'mappings'

export function isMappings<V>(v: V) {
  return is$typed(v, id, hashMappings)
}

export function validateMappings<V>(v: V) {
  return validate<Mappings & V>(v, id, hashMappings)
}

export interface Metadata {
  $type?: 'com.atproto.admin.createIdentityProvider#metadata'
  endpoints: Endpoints
  mappings: Mappings
  authMethods: AuthMethod[]
  codeChallengeMethods?: CodeChallengeMethod[]
}

const hashMetadata = 'metadata'

export function isMetadata<V>(v: V) {
  return is$typed(v, id, hashMetadata)
}

export function validateMetadata<V>(v: V) {
  return validate<Metadata & V>(v, id, hashMetadata)
}
