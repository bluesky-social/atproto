import * as accountPref from './account-pref'
import * as backlink from './backlink'
import * as blob from './blob'
import * as record from './record'
import * as recordBlob from './record-blob'
import * as repoBlock from './repo-block'
import * as repoRoot from './repo-root'
import * as space from './space'
import * as spaceMember from './space-member'
import * as spaceRecord from './space-record'
import * as spaceRepo from './space-repo'
import * as spaceMemberState from './space-member-state'
import * as spaceRecordOplog from './space-record-oplog'
import * as spaceMemberOplog from './space-member-oplog'
import * as spaceCredentialRecipient from './space-credential-recipient'

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
  spaceMemberState.PartialDB &
  spaceRecordOplog.PartialDB &
  spaceMemberOplog.PartialDB &
  spaceCredentialRecipient.PartialDB

export type { AccountPref } from './account-pref'
export type { RepoRoot } from './repo-root'
export type { Record } from './record'
export type { Backlink } from './backlink'
export type { RepoBlock } from './repo-block'
export type { Blob } from './blob'
export type { RecordBlob } from './record-blob'
export type { Space } from './space'
export type { SpaceMember } from './space-member'
export type { SpaceRecord } from './space-record'
export type { SpaceRepo } from './space-repo'
export type { SpaceMemberState } from './space-member-state'
export type { SpaceRecordOplog } from './space-record-oplog'
export type { SpaceMemberOplog } from './space-member-oplog'
export type { SpaceCredentialRecipient } from './space-credential-recipient'
