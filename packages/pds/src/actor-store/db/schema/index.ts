import * as accountPref from './account-pref.js'
import * as backlink from './backlink.js'
import * as blob from './blob.js'
import * as recordBlob from './record-blob.js'
import * as record from './record.js'
import * as repoBlock from './repo-block.js'
import * as repoRoot from './repo-root.js'
import * as space from './space.js'
import * as spaceCredentialRecipient from './space-credential-recipient.js'
import * as spaceMember from './space-member.js'
import * as spaceRecord from './space-record.js'
import * as spaceRecordOplog from './space-record-oplog.js'
import * as spaceRepo from './space-repo.js'

export type DatabaseSchema = accountPref.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  repoBlock.PartialDB &
  blob.PartialDB &
  recordBlob.PartialDB &
  space.PartialDB &
  spaceMember.PartialDB &
  spaceRecord.PartialDB &
  spaceRepo.PartialDB &
  spaceRecordOplog.PartialDB &
  spaceCredentialRecipient.PartialDB

export type { AccountPref } from './account-pref.js'
export type { RepoRoot } from './repo-root.js'
export type { Record } from './record.js'
export type { Backlink } from './backlink.js'
export type { RepoBlock } from './repo-block.js'
export type { Blob } from './blob.js'
export type { RecordBlob } from './record-blob.js'
export type { Space } from './space.js'
export type { SpaceMember } from './space-member.js'
export type { SpaceRecord } from './space-record.js'
export type { SpaceRepo } from './space-repo.js'
export type { SpaceRecordOplog } from './space-record-oplog.js'
export type { SpaceCredentialRecipient } from './space-credential-recipient.js'
