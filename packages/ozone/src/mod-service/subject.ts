import { AtUri } from '@atproto/syntax'
import { InputSchema as ReportInput } from '../lexicon/types/com/atproto/moderation/createReport'
import { InputSchema as ActionInput } from '../lexicon/types/com/atproto/admin/emitModerationEvent'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ModerationEventRow, ModerationSubjectStatusRow } from './types'
import { RepoRef } from '../lexicon/types/com/atproto/admin/defs'
import { Main as StrongRef } from '../lexicon/types/com/atproto/repo/strongRef'

type SubjectInput = ReportInput['subject'] | ActionInput['subject']

export const subjectFromInput = (
  subject: SubjectInput,
  blobs?: string[],
): ModSubject => {
  if (
    subject.$type === 'com.atproto.admin.defs#repoRef' &&
    typeof subject.did === 'string'
  ) {
    if (blobs && blobs.length > 0) {
      throw new InvalidRequestError('Blobs do not apply to repo subjects')
    }
    return new RepoSubject(subject.did)
  }
  if (
    subject.$type === 'com.atproto.repo.strongRef' &&
    typeof subject.uri === 'string' &&
    typeof subject.cid === 'string'
  ) {
    return new RecordSubject(subject.uri, subject.cid, blobs)
  }
  throw new InvalidRequestError('Invalid subject')
}

export const subjectFromEventRow = (row: ModerationEventRow): ModSubject => {
  if (
    row.subjectType === 'com.atproto.repo.strongRef' &&
    row.subjectUri &&
    row.subjectCid
  ) {
    return new RecordSubject(row.subjectUri, row.subjectCid)
  } else {
    return new RepoSubject(row.subjectDid)
  }
}

export const subjectFromStatusRow = (
  row: ModerationSubjectStatusRow,
): ModSubject => {
  if (row.recordPath && row.recordCid) {
    // Not too intuitive but the recordpath is basically <collection>/<rkey>
    // which is what the last 2 params of .make() arguments are
    const uri = AtUri.make(row.did, ...row.recordPath.split('/')).toString()
    return new RecordSubject(uri.toString(), row.recordCid)
  } else {
    return new RepoSubject(row.did)
  }
}

type SubjectInfo = {
  subjectType: 'com.atproto.admin.defs#repoRef' | 'com.atproto.repo.strongRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
}

export interface ModSubject {
  did: string
  recordPath: string | undefined
  blobCids?: string[]
  isRepo(): this is RepoSubject
  isRecord(): this is RecordSubject
  info(): SubjectInfo
  lex(): RepoRef | StrongRef
}

export class RepoSubject implements ModSubject {
  blobCids = undefined
  recordPath = undefined
  constructor(public did: string) {}
  isRepo() {
    return true
  }
  isRecord() {
    return false
  }
  info() {
    return {
      subjectType: 'com.atproto.admin.defs#repoRef' as const,
      subjectDid: this.did,
      subjectUri: null,
      subjectCid: null,
    }
  }
  lex(): RepoRef {
    return {
      $type: 'com.atproto.admin.defs#repoRef',
      did: this.did,
    }
  }
}

export class RecordSubject implements ModSubject {
  parsedUri: AtUri
  did: string
  recordPath: string
  constructor(
    public uri: string,
    public cid: string,
    public blobCids?: string[],
  ) {
    this.parsedUri = new AtUri(uri)
    this.did = this.parsedUri.hostname
    this.recordPath = `${this.parsedUri.collection}/${this.parsedUri.rkey}`
  }
  isRepo() {
    return false
  }
  isRecord() {
    return true
  }
  info() {
    return {
      subjectType: 'com.atproto.repo.strongRef' as const,
      subjectDid: this.did,
      subjectUri: this.uri,
      subjectCid: this.cid,
    }
  }
  lex(): StrongRef {
    return {
      $type: 'com.atproto.repo.strongRef',
      uri: this.uri,
      cid: this.cid,
    }
  }
}
