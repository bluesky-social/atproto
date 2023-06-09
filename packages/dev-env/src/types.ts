import * as pds from '@atproto/pds'
import * as bsky from '@atproto/bsky'

export type PlcConfig = {
  port?: number
  version?: string
}

export type PdsConfig = Partial<pds.ServerConfig> & {
  plcUrl: string
  migration?: string
}

export type BskyConfig = Partial<bsky.ServerConfig> & {
  plcUrl: string
  repoProvider: string
  dbPostgresUrl: string
  migration?: string
  algos?: bsky.MountedAlgos
}

export type TestServerParams = {
  dbPostgresUrl: string
  dbPostgresSchema: string
  pds: Partial<pds.ServerConfig>
  plc: Partial<pds.ServerConfig>
  bsky: Partial<BskyConfig>
}
