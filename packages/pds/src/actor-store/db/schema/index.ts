import * as accountPref from './account-pref'
import * as backlink from './backlink'
import * as blob from './blob'
import * as preorderMap from './preorder-map'
import * as record from './record'
import * as recordBlob from './record-blob'
import * as repoBlock from './repo-block'
import * as repoRoot from './repo-root'

export type DatabaseSchema = accountPref.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  repoBlock.PartialDB &
  blob.PartialDB &
  recordBlob.PartialDB &
  preorderMap.PartialDB

export type { AccountPref } from './account-pref'
export type { RepoRoot } from './repo-root'
export type { Record } from './record'
export type { Backlink } from './backlink'
export type { RepoBlock } from './repo-block'
export type { Blob } from './blob'
export type { RecordBlob } from './record-blob'
export type { PreorderMap } from './preorder-map'
