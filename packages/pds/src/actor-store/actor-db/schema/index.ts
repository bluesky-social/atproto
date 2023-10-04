import * as userPref from './user-pref'
import * as repoRoot from './repo-root'
import * as record from './record'
import * as backlink from './backlink'
import * as ipldBlock from './ipld-block'
import * as blob from './blob'
import * as repoBlob from './repo-blob'

export type DatabaseSchema = userPref.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  ipldBlock.PartialDB &
  blob.PartialDB &
  repoBlob.PartialDB

export type { UserPref } from './user-pref'
export type { RepoRoot } from './repo-root'
export type { Record } from './record'
export type { Backlink } from './backlink'
export type { IpldBlock } from './ipld-block'
export type { Blob } from './blob'
export type { RepoBlob } from './repo-blob'
