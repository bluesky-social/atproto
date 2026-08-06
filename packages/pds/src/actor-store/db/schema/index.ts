import * as accountPref from './account-pref.js'
import * as backlink from './backlink.js'
import * as blob from './blob.js'
import * as recordBlob from './record-blob.js'
import * as record from './record.js'
import * as repoBlock from './repo-block.js'
import * as repoRoot from './repo-root.js'
import * as simplespaceConfig from './simplespace-config.js'
import * as simplespaceMember from './simplespace-member.js'
import * as spaceCredentialRecipient from './space-credential-recipient.js'
import * as spaceRecordBlob from './space-record-blob.js'
import * as spaceRecordOplog from './space-record-oplog.js'
import * as spaceRecord from './space-record.js'
import * as spaceRepo from './space-repo.js'
import * as spaceWriter from './space-writer.js'
import * as space from './space.js'

export type DatabaseSchema = accountPref.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  repoBlock.PartialDB &
  blob.PartialDB &
  recordBlob.PartialDB &
  space.PartialDB &
  simplespaceConfig.PartialDB &
  simplespaceMember.PartialDB &
  spaceRecord.PartialDB &
  spaceRecordBlob.PartialDB &
  spaceRepo.PartialDB &
  spaceRecordOplog.PartialDB &
  spaceWriter.PartialDB &
  spaceCredentialRecipient.PartialDB

export type { AccountPref } from './account-pref.js'
export type { RepoRoot } from './repo-root.js'
export type { Record } from './record.js'
export type { Backlink } from './backlink.js'
export type { RepoBlock } from './repo-block.js'
export type { Blob } from './blob.js'
export type { RecordBlob } from './record-blob.js'
export type { Space } from './space.js'
export type { SimplespaceConfig } from './simplespace-config.js'
export type { SimplespaceMember } from './simplespace-member.js'
export type { SpaceRecord } from './space-record.js'
export type { SpaceRecordBlob } from './space-record-blob.js'
export type { SpaceRepo } from './space-repo.js'
export type { SpaceRecordOplog } from './space-record-oplog.js'
export type { SpaceWriter } from './space-writer.js'
export type { SpaceCredentialRecipient } from './space-credential-recipient.js'
