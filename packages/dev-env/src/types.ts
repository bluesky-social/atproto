import * as pds from '@atproto/pds'
import * as bsky from '@atproto/bsky'
import * as bsync from '@atproto/bsync'
import * as ozone from '@atproto/ozone'
import { ImageInvalidator } from '@atproto/bsky'
import { ExportableKeypair } from '@atproto/crypto'

export type PlcConfig = {
  port?: number
  version?: string
}

export type PdsConfig = Partial<pds.ServerEnvironment> & {
  didPlcUrl: string
  migration?: string
}

export type BskyConfig = Partial<bsky.ServerConfig> & {
  plcUrl: string
  repoProvider: string
  labelProvider: string
  dbPrimaryPostgresUrl: string
  redisHost: string
  pdsPort: number
  imgInvalidator?: ImageInvalidator
  migration?: string
  indexer?: Partial<bsky.IndexerConfig>
  ingester?: Partial<bsky.IngesterConfig>
}

export type BsyncConfig = Partial<bsync.ServerEnvironment> & {
  dbUrl: string
}

export type OzoneConfig = Partial<ozone.OzoneEnvironment> & {
  plcUrl: string
  appviewUrl: string
  dbPostgresUrl: string
  migration?: string
  signingKey?: ExportableKeypair
}

export type TestServerParams = {
  dbPostgresUrl: string
  dbPostgresSchema: string
  pds: Partial<PdsConfig>
  plc: Partial<PlcConfig>
  bsky: Partial<BskyConfig>
  ozone: Partial<OzoneConfig>
}
