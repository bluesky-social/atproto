import type * as bsky from '@atproto/bsky'
import type * as bsync from '@atproto/bsync'
import type { ExportableKeypair, Keypair } from '@atproto/crypto'
import type * as ozone from '@atproto/ozone'
import type * as pds from '@atproto/pds'

export type IntrospectConfig = {
  port?: number
}

export type PlcConfig = {
  port?: number
  version?: string
}

export type PdsConfig = Partial<pds.ServerEnvironment> & {
  didPlcUrl: string
  migration?: string
}

export type BskyConfig = Partial<bsky.ServerConfig> & {
  bsyncUrl: string
  plcUrl: string
  repoProvider: string
  dbPostgresUrl: string
  dbPostgresSchema: string
  redisHost: string
  pdsPort: number
  migration?: string
  privateKey?: string
}

export type BsyncConfig = Partial<bsync.ServerEnvironment> & {
  dbUrl: string
}

export type OzoneConfig = Partial<ozone.OzoneEnvironment> & {
  plcUrl: string
  appviewUrl: string
  appviewDid: string
  dbPostgresUrl: string
  migration?: string
  signingKey?: ExportableKeypair
  imgInvalidator?: ozone.ImageInvalidator
}

export type TestServerParams = {
  dbPostgresUrl: string
  dbPostgresSchema: string
  pds: Partial<PdsConfig>
  plc: Partial<PlcConfig>
  bsky: Partial<BskyConfig>
  ozone: Partial<OzoneConfig>
  introspect: Partial<IntrospectConfig>
  extraPdses: number
  /**
   * Create a lexicon-authority account and point every PDS at it, so lexicon
   * documents (permission sets, `space` declarations) resolve. Opt-in: it costs
   * an account creation plus a record write per document, which most tests don't
   * need. `TestNetwork` always does this.
   */
  lexiconAuthority: boolean
}

export type DidAndKey = {
  did: string
  key: Keypair
}
