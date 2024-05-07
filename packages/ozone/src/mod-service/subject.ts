import { AtUri } from '@atproto/syntax'
import { InputSchema as ReportInput } from '../lexicon/types/com/atproto/moderation/createReport'
import { InputSchema as ActionInput } from '../lexicon/types/tools/ozone/moderation/emitEvent'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ModerationEventRow, ModerationSubjectStatusRow } from './types'
import { RepoRef } from '../lexicon/types/com/atproto/admin/defs'
import { Main as StrongRef } from '../lexicon/types/com/atproto/repo/strongRef'
import { MessageRef } from '../lexicon/types/chat/bsky/convo/defs'

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
  if (
    subject.$type === 'chat.bsky.convo.defs#messageRef' &&
    typeof subject.did === 'string' &&
    typeof subject.messageId === 'string'
  ) {
    return new MessageSubject(subject.did, subject.messageId)
  }

  throw new InvalidRequestError('Invalid subject')
}

export const subjectFromEventRow = (row: ModerationEventRow): ModSubject => {
  if (
    row.subjectType === 'com.atproto.repo.strongRef' &&
    row.subjectUri &&
    row.subjectCid
  ) {
    return new RecordSubject(
      row.subjectUri,
      row.subjectCid,
      row.subjectBlobCids ?? [],
    )
  } else if (
    row.subjectType === 'chat.bsky.convo.defs#messageRef' &&
    row.subjectMessageId
  ) {
    return new MessageSubject(row.subjectDid, row.subjectMessageId)
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
    return new RecordSubject(uri.toString(), row.recordCid, row.blobCids ?? [])
  } else {
    return new RepoSubject(row.did)
  }
}

type SubjectInfo = {
  subjectType:
    | 'com.atproto.admin.defs#repoRef'
    | 'com.atproto.repo.strongRef'
    | 'chat.bsky.convo.defs#messageRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  subjectBlobCids: string[] | null
  subjectMessageId: string | null
}

export interface ModSubject {
  did: string
  recordPath: string | undefined
  blobCids?: string[]
  isRepo(): this is RepoSubject
  isRecord(): this is RecordSubject
  isMessage(): this is MessageSubject
  info(): SubjectInfo
  lex(): RepoRef | StrongRef | MessageRef
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
  isMessage() {
    return false
  }
  info() {
    return {
      subjectType: 'com.atproto.admin.defs#repoRef' as const,
      subjectDid: this.did,
      subjectUri: null,
      subjectCid: null,
      subjectBlobCids: null,
      subjectMessageId: null,
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
  isMessage() {
    return false
  }
  info() {
    return {
      subjectType: 'com.atproto.repo.strongRef' as const,
      subjectDid: this.did,
      subjectUri: this.uri,
      subjectCid: this.cid,
      subjectBlobCids: this.blobCids ?? [],
      subjectMessageId: null,
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

export class MessageSubject implements ModSubject {
  blobCids = undefined
  recordPath = undefined
  constructor(
    public did: string,
    public messageId: string,
  ) {}
  isRepo() {
    return false
  }
  isRecord() {
    return false
  }
  isMessage() {
    return true
  }
  info() {
    return {
      subjectType: 'chat.bsky.convo.defs#messageRef' as const,
      subjectDid: this.did,
      subjectUri: null,
      subjectCid: null,
      subjectBlobCids: null,
      subjectMessageId: this.messageId,
    }
  }
  lex(): MessageRef {
    return {
      $type: 'chat.bsky.convo.defs#messageRef',
      did: this.did,
      messageId: this.messageId,
    }
  }
}
