import * as accountPref from './account-pref.js'
import * as backlink from './backlink.js'
import * as blob from './blob.js'
import * as recordBlob from './record-blob.js'
import * as record from './record.js'
import * as repoBlock from './repo-block.js'
import * as repoRoot from './repo-root.js'

export type DatabaseSchema = accountPref.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  repoBlock.PartialDB &
  blob.PartialDB &
  recordBlob.PartialDB

export type { AccountPref } from './account-pref.js'
export type { RepoRoot } from './repo-root.js'
export type { Record } from './record.js'
export type { Backlink } from './backlink.js'
export type { RepoBlock } from './repo-block.js'
export type { Blob } from './blob.js'
export type { RecordBlob } from './record-blob.js'
