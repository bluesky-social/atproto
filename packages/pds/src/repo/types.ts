import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { WriteOpAction } from '@atproto/repo'
import { RepoRecord } from '@atproto/lexicon'

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

export type PreparedBlobRef = {
  cid: CID
  mimeType: string
  constraints: BlobConstraint
}

export type PreparedCreate = {
  action: WriteOpAction.Create
  uri: AtUri
  cid: CID
  record: RepoRecord
  blobs: PreparedBlobRef[]
}

export type PreparedUpdate = {
  action: WriteOpAction.Update
  uri: AtUri
  cid: CID
  record: RepoRecord
  blobs: PreparedBlobRef[]
}

export type PreparedDelete = {
  action: WriteOpAction.Delete
  uri: AtUri
}

export type PreparedWrite = PreparedCreate | PreparedUpdate | PreparedDelete

export class InvalidRecordError extends Error {}
