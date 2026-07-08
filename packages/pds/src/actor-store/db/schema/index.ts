import type * as accountPref from './account-pref.js'
import type * as backlink from './backlink.js'
import type * as blob from './blob.js'
import type * as recordBlob from './record-blob.js'
import type * as record from './record.js'
import type * as repoBlock from './repo-block.js'
import type * as repoRoot from './repo-root.js'

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
