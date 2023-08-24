import * as pds from '@atproto/pds'
import * as bsky from '@atproto/bsky'

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
