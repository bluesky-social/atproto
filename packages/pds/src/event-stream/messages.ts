// Below specific to message dispatcher

import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/uri'
import { WriteOpAction } from '@atproto/repo'

export type IndexRecord = {
  type: 'index_record'
  action: WriteOpAction.Create | WriteOpAction.Update
  uri: AtUri
  cid: CID
  obj: unknown
  timestamp: string
}

export type DeleteRecord = {
  type: 'delete_record'
  uri: AtUri
  cascading: boolean
}

export type DeleteRepo = {
  type: 'delete_repo'
  did: string
}

export const indexRecord = (
  uri: AtUri,
  cid: CID,
  obj: unknown,
  action: WriteOpAction.Create | WriteOpAction.Update,
  timestamp: string,
): IndexRecord => ({
  type: 'index_record',
  uri,
  cid,
  obj,
  action,
  timestamp,
})

export const deleteRecord = (uri: AtUri, cascading: boolean): DeleteRecord => ({
  type: 'delete_record',
  uri,
  cascading,
})

export const deleteRepo = (did: string): DeleteRepo => ({
  type: 'delete_repo',
  did,
})
