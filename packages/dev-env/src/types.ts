import * as pds from '@atproto/pds'
import * as bsky from '@atproto/bsky'
import { ImageInvalidator } from '@atproto/bsky/src/image/invalidator'

export type PlcConfig = {
  port?: number
  version?: string
}

export type PdsConfig = Partial<pds.ServerConfig> & {
  plcUrl: string
  migration?: string
  enableInProcessAppView?: boolean
  algos?: pds.MountedAlgos
  enableLabelsCache?: boolean
}

export type BskyConfig = Partial<bsky.ServerConfig> & {
  plcUrl: string
  repoProvider: string
  dbPrimaryPostgresUrl: string
  redisHost: string
  pdsPort: number
  imgInvalidator?: ImageInvalidator
  migration?: string
  algos?: bsky.MountedAlgos
}

export type TestServerParams = {
  dbPostgresUrl: string
  dbPostgresSchema: string
  pds: Partial<PdsConfig>
  plc: Partial<pds.ServerConfig>
  bsky: Partial<BskyConfig>
}
