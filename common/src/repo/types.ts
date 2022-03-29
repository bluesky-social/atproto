import { z } from 'zod'
import { BlockWriter } from '@ipld/car/writer'
import { CID } from 'multiformats/cid'
import { schema as common } from '../common/types.js'
import TID from './tid.js'

const tid = z.instanceof(TID)

const repoRoot = z.object({
  did: common.did,
  prev: common.cid.nullable(),
  new_cids: z.array(common.cid),
  relationships: common.cid,
  programs: z.record(common.cid),
})
export type RepoRoot = z.infer<typeof repoRoot>

const programRoot = z.object({
  posts: common.cid,
  interactions: common.cid,
  profile: common.cid.nullable(),
})
export type ProgramRoot = z.infer<typeof programRoot>

const commit = z.object({
  root: common.cid,
  sig: common.bytes,
})
export type Commit = z.infer<typeof commit>

const idMapping = z.record(common.cid)
export type IdMapping = z.infer<typeof idMapping>

const entry = z.object({
  tid: tid,
  cid: common.cid,
})
export type Entry = z.infer<typeof entry>

const follow = z.object({
  did: z.string(),
  username: z.string(),
})
export type Follow = z.infer<typeof follow>

export const schema = {
  ...common,
  tid,
  repoRoot,
  programRoot,
  commit,
  idMapping,
  entry,
  follow,
}

export interface CarStreamable {
  writeToCarStream(car: BlockWriter): Promise<void>
}
