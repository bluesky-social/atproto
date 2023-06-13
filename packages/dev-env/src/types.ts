import * as pds from '@atproto/pds'
import * as bsky from '@atproto/bsky'

export type PlcConfig = {
  port?: number
  version?: string
}

export type PdsConfig = Partial<pds.ServerEnvironment> & {
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
  pds: Partial<pds.ServerEnvironment>
  plc: Partial<PlcConfig>
  bsky: Partial<BskyConfig>
}
