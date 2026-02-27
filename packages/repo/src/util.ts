import { TID } from '@atproto/common-web'
import * as crypto from '@atproto/crypto'
import { Keypair } from '@atproto/crypto'
import * as cbor from '@atproto/lex-cbor'
import { Cid, LexMap, LexValue, isPlainObject } from '@atproto/lex-data'
import { ensureValidNsid } from '@atproto/syntax'
import { DataDiff } from './data-diff'
import {
  Commit,
  LegacyV2Commit,
  RecordCreateDescript,
  RecordDeleteDescript,
  RecordPath,
  RecordUpdateDescript,
  RecordWriteDescript,
  UnsignedCommit,
  WriteOpAction,
} from './types'

export const diffToWriteDescripts = (
  diff: DataDiff,
): Promise<RecordWriteDescript[]> => {
  return Promise.all([
    ...diff.addList().map(async (add) => {
      const { collection, rkey } = parseDataKey(add.key)
      return {
        action: WriteOpAction.Create,
        collection,
        rkey,
        cid: add.cid,
      } as RecordCreateDescript
    }),
    ...diff.updateList().map(async (upd) => {
      const { collection, rkey } = parseDataKey(upd.key)
      return {
        action: WriteOpAction.Update,
        collection,
        rkey,
        cid: upd.cid,
        prev: upd.prev,
      } as RecordUpdateDescript
    }),
    ...diff.deleteList().map((del) => {
      const { collection, rkey } = parseDataKey(del.key)
      return {
        action: WriteOpAction.Delete,
        collection,
        rkey,
        cid: del.cid,
      } as RecordDeleteDescript
    }),
  ])
}

export const ensureCreates = (
  descripts: RecordWriteDescript[],
): RecordCreateDescript[] => {
  const creates: RecordCreateDescript[] = []
  for (const descript of descripts) {
    if (descript.action !== WriteOpAction.Create) {
      throw new Error(`Unexpected action: ${descript.action}`)
    } else {
      creates.push(descript)
    }
  }
  return creates
}

export const parseDataKey = (key: string): RecordPath => {
  const { length, 0: collection, 1: rkey } = key.split('/')
  if (length !== 2) throw new Error(`Invalid record key: ${key}`)
  ensureValidNsid(collection)
  return { collection, rkey }
}

export const formatDataKey = (collection: string, rkey: string): string => {
  return collection + '/' + rkey
}

export const metaEqual = (a: Commit, b: Commit): boolean => {
  return a.did === b.did && a.version === b.version
}

export const signCommit = async (
  unsigned: UnsignedCommit,
  keypair: Keypair,
): Promise<Commit> => {
  const encoded = cbor.encode(unsigned)
  const sig = await keypair.sign(encoded)
  return {
    ...unsigned,
    sig,
  }
}

export const verifyCommitSig = async (
  commit: Commit,
  didKey: string,
): Promise<boolean> => {
  const { sig, ...rest } = commit
  const encoded = cbor.encode(rest)
  return crypto.verifySignature(didKey, encoded, sig)
}

export const cborToLex: (val: Uint8Array) => LexValue = cbor.decode

export const cborToLexRecord = (val: Uint8Array): LexMap => {
  const parsed = cborToLex(val)
  if (!isPlainObject(parsed)) {
    throw new Error('lexicon records be a json object')
  }
  return parsed
}

export const cidForRecord: (val: LexValue) => Promise<Cid> = cbor.cidForLex

export const ensureV3Commit = (commit: LegacyV2Commit | Commit): Commit => {
  if (commit.version === 3) {
    return commit
  } else {
    return {
      ...commit,
      version: 3,
      rev: commit.rev ?? TID.nextStr(),
    }
  }
}
