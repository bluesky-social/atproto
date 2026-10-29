import type * as accountPref from './account-pref.js'
import type * as backlink from './backlink.js'
import type * as blob from './blob.js'
import type * as memberspaceMember from './memberspace-member.js'
import type * as recordBlob from './record-blob.js'
import type * as record from './record.js'
import type * as repoBlock from './repo-block.js'
import type * as repoRoot from './repo-root.js'
import type * as spaceCredentialRecipient from './space-credential-recipient.js'
import type * as spacePolicy from './space-policy.js'
import type * as spaceRecordBlob from './space-record-blob.js'
import type * as spaceRecordOplog from './space-record-oplog.js'
import type * as spaceRecord from './space-record.js'
import type * as spaceRepo from './space-repo.js'
import type * as spaceWriter from './space-writer.js'
import type * as space from './space.js'

export type DatabaseSchema = accountPref.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  backlink.PartialDB &
  repoBlock.PartialDB &
  blob.PartialDB &
  recordBlob.PartialDB &
  space.PartialDB &
  spacePolicy.PartialDB &
  memberspaceMember.PartialDB &
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
export type { SpacePolicy } from './space-policy.js'
export type { MemberspaceMember } from './memberspace-member.js'
export type { SpaceRecord } from './space-record.js'
export type { SpaceRecordBlob } from './space-record-blob.js'
export type { SpaceRepo } from './space-repo.js'
export type { SpaceRecordOplog } from './space-record-oplog.js'
export type { SpaceWriter } from './space-writer.js'
export type { SpaceCredentialRecipient } from './space-credential-recipient.js'
