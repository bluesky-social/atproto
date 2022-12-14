import { CID } from 'multiformats/cid'
import { DeleteOp, RecordCreateOp, RecordUpdateOp } from '@atproto/repo'
import { AtUri } from '@atproto/uri'

export type ImageConstraint = {
  type: 'image'
  accept?: string[]
  maxHeight?: number
  maxWidth?: number
  minHeight?: number
  minWidth?: number
  maxSize?: number
}

export type RawBlobConstraint = {
  type: 'blob'
  accept?: string[]
  maxSize?: number
}

export type BlobConstraint = RawBlobConstraint | ImageConstraint

export type BlobRef = {
  cid: CID
  mimeType: string
  constraints: BlobConstraint
}

export type PreparedCreate = {
  action: 'create'
  uri: AtUri
  cid: CID
  op: RecordCreateOp
  blobs: BlobRef[]
}

export type PreparedUpdate = {
  action: 'update'
  uri: AtUri
  cid: CID
  op: RecordUpdateOp
  blobs: BlobRef[]
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

export class InvalidRecordError extends Error {}
