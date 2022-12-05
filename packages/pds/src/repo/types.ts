import { CID } from 'multiformats/cid'
import { DeleteOp, RecordCreateOp, RecordUpdateOp } from '@atproto/repo'
import { AtUri } from '@atproto/uri'

export type PreparedCreate = {
  action: 'create'
  uri: AtUri
  cid: CID
  op: RecordCreateOp
  blobs: CID[]
}

export type PreparedUpdate = {
  action: 'update'
  uri: AtUri
  cid: CID
  op: RecordUpdateOp
  blobs: CID[]
}

export type PreparedDelete = {
  action: 'delete'
  uri: AtUri
  op: DeleteOp
}

export type PreparedWrites = (
  | PreparedCreate
  | PreparedUpdate
  | PreparedDelete
)[]
