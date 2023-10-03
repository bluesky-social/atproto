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
