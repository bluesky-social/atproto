import * as pds from '@atproto/pds'
import * as plc from '@did-plc/server'
import * as bsky from '@atproto/bsky'
import { RepoSubscription } from '@atproto/bsky/src/subscription/repo'

export type CloseFn = () => Promise<void>

export type ServerInfo = {
  port: number
  url: string
  close: CloseFn
}

export type PlcServerInfo = ServerInfo & {
  ctx: plc.AppContext
}

export type PdsServerInfo = ServerInfo & {
  ctx: pds.AppContext
}

export type BskyServerInfo = ServerInfo & {
  ctx: bsky.AppContext
  sub: RepoSubscription
}

export type TestEnvInfo = {
  bsky: BskyServerInfo
  pds: PdsServerInfo
  plc: PlcServerInfo
  close: CloseFn
}

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
}

export type TestServerParams = {
  dbPostgresUrl: string
  dbPostgresSchema: string
  pds: Partial<pds.ServerConfig>
  bsky: Partial<bsky.ServerConfig>
}
