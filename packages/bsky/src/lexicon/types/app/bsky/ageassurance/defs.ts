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
const id = 'app.bsky.ageassurance.defs'

/** The access level granted based on Age Assurance data we've processed. */
export type Access = 'unknown' | 'none' | 'safe' | 'full' | (string & {})
/** The status of the Age Assurance process. */
export type Status =
  | 'unknown'
  | 'pending'
  | 'assured'
  | 'blocked'
  | (string & {})

/** The user's computed Age Assurance state. */
export interface State {
  $type?: 'app.bsky.ageassurance.defs#state'
  /** The timestamp when this state was last updated. */
  lastInitiatedAt?: string
  status: Status
  access: Access
}

const hashState = 'state'

export function isState<V>(v: V) {
  return is$typed(v, id, hashState)
}

export function validateState<V>(v: V) {
  return validate<State & V>(v, id, hashState)
}

/** Additional metadata needed to compute Age Assurance state client-side. */
export interface StateMetadata {
  $type?: 'app.bsky.ageassurance.defs#stateMetadata'
  /** The account creation timestamp. */
  accountCreatedAt?: string
}

const hashStateMetadata = 'stateMetadata'

export function isStateMetadata<V>(v: V) {
  return is$typed(v, id, hashStateMetadata)
}

export function validateStateMetadata<V>(v: V) {
  return validate<StateMetadata & V>(v, id, hashStateMetadata)
}

export interface Config {
  $type?: 'app.bsky.ageassurance.defs#config'
  /** The per-region Age Assurance configuration. */
  regions: ConfigRegion[]
}

const hashConfig = 'config'

export function isConfig<V>(v: V) {
  return is$typed(v, id, hashConfig)
}

export function validateConfig<V>(v: V) {
  return validate<Config & V>(v, id, hashConfig)
}

/** The Age Assurance configuration for a specific region. */
export interface ConfigRegion {
  $type?: 'app.bsky.ageassurance.defs#configRegion'
  /** The ISO 3166-1 alpha-2 country code this configuration applies to. */
  countryCode: string
  /** The ISO 3166-2 region code this configuration applies to. If omitted, the configuration applies to the entire country. */
  regionCode?: string
  /** The minimum age (as a whole integer) required to use Bluesky in this region. */
  minAccessAge: number
  /** The ordered list of Age Assurance rules that apply to this region. Rules should be applied in order, and the first matching rule determines the access level granted. The rules array should always include a default rule as the last item. */
  rules: (
    | $Typed<ConfigRegionRuleDefault>
    | $Typed<ConfigRegionRuleIfDeclaredOverAge>
    | $Typed<ConfigRegionRuleIfDeclaredUnderAge>
    | $Typed<ConfigRegionRuleIfAssuredOverAge>
    | $Typed<ConfigRegionRuleIfAssuredUnderAge>
    | $Typed<ConfigRegionRuleIfAccountNewerThan>
    | $Typed<ConfigRegionRuleIfAccountOlderThan>
    | { $type: string }
  )[]
}

const hashConfigRegion = 'configRegion'

export function isConfigRegion<V>(v: V) {
  return is$typed(v, id, hashConfigRegion)
}

export function validateConfigRegion<V>(v: V) {
  return validate<ConfigRegion & V>(v, id, hashConfigRegion)
}

/** Age Assurance rule that applies by default. */
export interface ConfigRegionRuleDefault {
  $type?: 'app.bsky.ageassurance.defs#configRegionRuleDefault'
  access: Access
}

const hashConfigRegionRuleDefault = 'configRegionRuleDefault'

export function isConfigRegionRuleDefault<V>(v: V) {
  return is$typed(v, id, hashConfigRegionRuleDefault)
}

export function validateConfigRegionRuleDefault<V>(v: V) {
  return validate<ConfigRegionRuleDefault & V>(
    v,
    id,
    hashConfigRegionRuleDefault,
  )
}

/** Age Assurance rule that applies if the user has declared themselves equal-to or over a certain age. */
export interface ConfigRegionRuleIfDeclaredOverAge {
  $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfDeclaredOverAge'
  /** The age threshold as a whole integer. */
  age: number
  access: Access
}

const hashConfigRegionRuleIfDeclaredOverAge =
  'configRegionRuleIfDeclaredOverAge'

export function isConfigRegionRuleIfDeclaredOverAge<V>(v: V) {
  return is$typed(v, id, hashConfigRegionRuleIfDeclaredOverAge)
}

export function validateConfigRegionRuleIfDeclaredOverAge<V>(v: V) {
  return validate<ConfigRegionRuleIfDeclaredOverAge & V>(
    v,
    id,
    hashConfigRegionRuleIfDeclaredOverAge,
  )
}

/** Age Assurance rule that applies if the user has declared themselves under a certain age. */
export interface ConfigRegionRuleIfDeclaredUnderAge {
  $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfDeclaredUnderAge'
  /** The age threshold as a whole integer. */
  age: number
  access: Access
}

const hashConfigRegionRuleIfDeclaredUnderAge =
  'configRegionRuleIfDeclaredUnderAge'

export function isConfigRegionRuleIfDeclaredUnderAge<V>(v: V) {
  return is$typed(v, id, hashConfigRegionRuleIfDeclaredUnderAge)
}

export function validateConfigRegionRuleIfDeclaredUnderAge<V>(v: V) {
  return validate<ConfigRegionRuleIfDeclaredUnderAge & V>(
    v,
    id,
    hashConfigRegionRuleIfDeclaredUnderAge,
  )
}

/** Age Assurance rule that applies if the user has been assured to be equal-to or over a certain age. */
export interface ConfigRegionRuleIfAssuredOverAge {
  $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAssuredOverAge'
  /** The age threshold as a whole integer. */
  age: number
  access: Access
}

const hashConfigRegionRuleIfAssuredOverAge = 'configRegionRuleIfAssuredOverAge'

export function isConfigRegionRuleIfAssuredOverAge<V>(v: V) {
  return is$typed(v, id, hashConfigRegionRuleIfAssuredOverAge)
}

export function validateConfigRegionRuleIfAssuredOverAge<V>(v: V) {
  return validate<ConfigRegionRuleIfAssuredOverAge & V>(
    v,
    id,
    hashConfigRegionRuleIfAssuredOverAge,
  )
}

/** Age Assurance rule that applies if the user has been assured to be under a certain age. */
export interface ConfigRegionRuleIfAssuredUnderAge {
  $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAssuredUnderAge'
  /** The age threshold as a whole integer. */
  age: number
  access: Access
}

const hashConfigRegionRuleIfAssuredUnderAge =
  'configRegionRuleIfAssuredUnderAge'

export function isConfigRegionRuleIfAssuredUnderAge<V>(v: V) {
  return is$typed(v, id, hashConfigRegionRuleIfAssuredUnderAge)
}

export function validateConfigRegionRuleIfAssuredUnderAge<V>(v: V) {
  return validate<ConfigRegionRuleIfAssuredUnderAge & V>(
    v,
    id,
    hashConfigRegionRuleIfAssuredUnderAge,
  )
}

/** Age Assurance rule that applies if the account is equal-to or newer than a certain date. */
export interface ConfigRegionRuleIfAccountNewerThan {
  $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAccountNewerThan'
  /** The date threshold as a datetime string. */
  date: string
  access: Access
}

const hashConfigRegionRuleIfAccountNewerThan =
  'configRegionRuleIfAccountNewerThan'

export function isConfigRegionRuleIfAccountNewerThan<V>(v: V) {
  return is$typed(v, id, hashConfigRegionRuleIfAccountNewerThan)
}

export function validateConfigRegionRuleIfAccountNewerThan<V>(v: V) {
  return validate<ConfigRegionRuleIfAccountNewerThan & V>(
    v,
    id,
    hashConfigRegionRuleIfAccountNewerThan,
  )
}

/** Age Assurance rule that applies if the account is older than a certain date. */
export interface ConfigRegionRuleIfAccountOlderThan {
  $type?: 'app.bsky.ageassurance.defs#configRegionRuleIfAccountOlderThan'
  /** The date threshold as a datetime string. */
  date: string
  access: Access
}

const hashConfigRegionRuleIfAccountOlderThan =
  'configRegionRuleIfAccountOlderThan'

export function isConfigRegionRuleIfAccountOlderThan<V>(v: V) {
  return is$typed(v, id, hashConfigRegionRuleIfAccountOlderThan)
}

export function validateConfigRegionRuleIfAccountOlderThan<V>(v: V) {
  return validate<ConfigRegionRuleIfAccountOlderThan & V>(
    v,
    id,
    hashConfigRegionRuleIfAccountOlderThan,
  )
}

/** Object used to store Age Assurance data in stash. */
export interface Event {
  $type?: 'app.bsky.ageassurance.defs#event'
  /** The date and time of this write operation. */
  createdAt: string
  /** The unique identifier for this instance of the Age Assurance flow, in UUID format. */
  attemptId: string
  /** The status of the Age Assurance process. */
  status: 'unknown' | 'pending' | 'assured' | 'blocked' | (string & {})
  /** The access level granted based on Age Assurance data we've processed. */
  access: 'unknown' | 'none' | 'safe' | 'full' | (string & {})
  /** The ISO 3166-1 alpha-2 country code provided when beginning the Age Assurance flow. */
  countryCode: string
  /** The ISO 3166-2 region code provided when beginning the Age Assurance flow. */
  regionCode?: string
  /** The email used for Age Assurance. */
  email?: string
  /** The IP address used when initiating the Age Assurance flow. */
  initIp?: string
  /** The user agent used when initiating the Age Assurance flow. */
  initUa?: string
  /** The IP address used when completing the Age Assurance flow. */
  completeIp?: string
  /** The user agent used when completing the Age Assurance flow. */
  completeUa?: string
}

const hashEvent = 'event'

export function isEvent<V>(v: V) {
  return is$typed(v, id, hashEvent)
}

export function validateEvent<V>(v: V) {
  return validate<Event & V>(v, id, hashEvent)
}
