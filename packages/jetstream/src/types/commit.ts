import { UnknownRecord } from './record.js'

export enum CommitOperation {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export type CommitBase = {
  rev: string
  collection: string
  rkey: string
  operation: CommitOperation
}

export type CommitCreate = CommitBase & {
  collection: string
  operation: CommitOperation.Create
  record: UnknownRecord
}

export type CommitUpdate = CommitBase & {
  collection: string
  operation: CommitOperation.Update
  cid: string
  record: UnknownRecord
}

export type CommitDelete = CommitBase & {
  collection: string
  operation: CommitOperation.Delete
}

export function isCommit(value: unknown) {
  return (
    value != null &&
    typeof value === 'object' &&
    'operation' in value &&
    (value.operation === CommitOperation.Update ||
      value.operation === CommitOperation.Create ||
      value.operation === CommitOperation.Delete)
  )
}
