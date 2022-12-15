import { CID } from 'multiformats/cid'
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
  record: Record<string, unknown>
  blobs: BlobRef[]
}

export type PreparedUpdate = {
  action: 'update'
  uri: AtUri
  cid: CID
  record: Record<string, unknown>
  blobs: BlobRef[]
}

export type PreparedDelete = {
  action: 'delete'
  uri: AtUri
}

export type PreparedWrite = PreparedCreate | PreparedUpdate | PreparedDelete

export class InvalidRecordError extends Error {}
