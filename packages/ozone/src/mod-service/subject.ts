import { AtUri } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as ChatBskyConvoDefs from '../lexicon/types/chat/bsky/convo/defs.js'
import { RepoRef, isRepoRef } from '../lexicon/types/com/atproto/admin/defs.js'
import { InputSchema as ReportInput } from '../lexicon/types/com/atproto/moderation/createReport.js'
import * as ComAtprotoRepoStrongRef from '../lexicon/types/com/atproto/repo/strongRef.js'
import { InputSchema as ActionInput } from '../lexicon/types/tools/ozone/moderation/emitEvent.js'
import { $Typed, asPredicate } from '../lexicon/util.js'
import { ModerationEventRow, ModerationSubjectStatusRow } from './types.js'

type SubjectInput = ReportInput['subject'] | ActionInput['subject']

type StrongRef = ComAtprotoRepoStrongRef.Main
const isStrongRef = asPredicate(ComAtprotoRepoStrongRef.validateMain)

type MessageRef = ChatBskyConvoDefs.MessageRef
const isValidMessageRef = asPredicate(ChatBskyConvoDefs.validateMessageRef)

type ConvoRef = ChatBskyConvoDefs.ConvoRef
const isValidConvoRef = asPredicate(ChatBskyConvoDefs.validateConvoRef)

const isMessageRefWithoutConvoId = (
  subject: unknown,
): subject is $Typed<Omit<MessageRef, 'convoId'> & { convoId?: string }> =>
  subject != null &&
  typeof subject === 'object' &&
  isValidMessageRef({ convoId: '', ...subject })

/**
 * Cast subject input into ModSubject.
 * @description Represents the subject types that can appear in the moderation event stream.
 * NOTE: Downstream services should be updated to handle new subject types including appview.
 */
export const subjectFromInput = (
  subject: SubjectInput,
  blobs?: string[],
): ModSubject => {
  if (isRepoRef(subject)) {
    if (blobs && blobs.length > 0) {
      throw new InvalidRequestError('Blobs do not apply to repo subjects')
    }
    return new RepoSubject(subject.did)
  }
  if (isStrongRef(subject)) {
    return new RecordSubject(subject.uri, subject.cid, blobs)
  }
  // @NOTE #messageRef is not a report input for com.atproto.moderation.createReport.
  // we are taking advantage of the open union in order for bsky.chat to interoperate here.
  if (isValidMessageRef(subject)) {
    return new MessageSubject(subject.did, subject.convoId, subject.messageId)
  }
  // @NOTE #convoRef is a new type for reporting entire conversations.
  // Similar to messageRef, we take advantage of the open union to support this.
  if (isValidConvoRef(subject)) {
    return new ConvoSubject(subject.did, subject.convoId)
  }
  // @TODO we should start to require subject.convoId is a string in order to properly validate
  // the #messageRef. temporarily allowing it to be optional as a stopgap for rollout.
  // The next "if" can be removed once convoId is consistently provided.
  if (isMessageRefWithoutConvoId(subject)) {
    return new MessageSubject(
      subject.did,
      subject.convoId ?? '',
      subject.messageId,
    )
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
    const convoId =
      typeof row.meta?.['convoId'] === 'string' ? row.meta['convoId'] : ''
    return new MessageSubject(row.subjectDid, convoId, row.subjectMessageId)
  } else if (
    row.subjectType === 'chat.bsky.convo.defs#convoRef' &&
    row.subjectConvoId
  ) {
    return new ConvoSubject(row.subjectDid, row.subjectConvoId)
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
  } else if (row.convoId) {
    // Conversation subject - restore from subject status row
    return new ConvoSubject(row.did, row.convoId)
  } else {
    return new RepoSubject(row.did)
  }
}

type SubjectInfo = {
  subjectType:
    | 'com.atproto.admin.defs#repoRef'
    | 'com.atproto.repo.strongRef'
    | 'chat.bsky.convo.defs#messageRef'
    | 'chat.bsky.convo.defs#convoRef'
  subjectDid: string
  subjectUri: string | null
  subjectCid: string | null
  subjectBlobCids: string[] | null
  subjectMessageId: string | null
  subjectConvoId: string | null
  meta: Record<string, string | undefined> | null
}

export interface ModSubject {
  did: string
  recordPath: string | undefined
  convoId: string | undefined
  blobCids?: string[]
  isRepo(): this is RepoSubject
  isRecord(): this is RecordSubject
  isMessage(): this is MessageSubject
  isConvo(): this is ConvoSubject
  info(): SubjectInfo
  lex():
    | $Typed<RepoRef>
    | $Typed<StrongRef>
    | $Typed<MessageRef>
    | $Typed<ConvoRef>
}

export class RepoSubject implements ModSubject {
  blobCids = undefined
  recordPath = undefined
  convoId = undefined
  constructor(public did: string) {}
  isRepo(): this is RepoSubject {
    return true
  }
  isRecord(): this is RecordSubject {
    return false
  }
  isMessage(): this is MessageSubject {
    return false
  }
  isConvo(): this is ConvoSubject {
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
      subjectConvoId: null,
      meta: null,
    }
  }
  lex(): $Typed<RepoRef> {
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
  convoId = undefined
  constructor(
    public uri: string,
    public cid: string,
    public blobCids?: string[],
  ) {
    this.parsedUri = new AtUri(uri)
    this.did = this.parsedUri.hostname
    this.recordPath = `${this.parsedUri.collection}/${this.parsedUri.rkey}`
  }
  isRepo(): this is RepoSubject {
    return false
  }
  isRecord(): this is RecordSubject {
    return true
  }
  isMessage(): this is MessageSubject {
    return false
  }
  isConvo(): this is ConvoSubject {
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
      subjectConvoId: null,
      meta: null,
    }
  }
  lex(): $Typed<StrongRef> {
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
    public convoId: string,
    public messageId: string,
  ) {}
  isRepo(): this is RepoSubject {
    return false
  }
  isRecord(): this is RecordSubject {
    return false
  }
  isMessage(): this is MessageSubject {
    return true
  }
  isConvo(): this is ConvoSubject {
    return false
  }
  info() {
    return {
      subjectType: 'chat.bsky.convo.defs#messageRef' as const,
      subjectDid: this.did,
      subjectUri: null,
      subjectCid: null,
      subjectBlobCids: null,
      subjectMessageId: this.messageId,
      subjectConvoId: this.convoId,
      meta: { convoId: this.convoId || undefined },
    }
  }
  lex(): $Typed<MessageRef> {
    return {
      $type: 'chat.bsky.convo.defs#messageRef',
      did: this.did,
      convoId: this.convoId,
      messageId: this.messageId,
    }
  }
}

export class ConvoSubject implements ModSubject {
  blobCids = undefined
  recordPath = undefined
  constructor(
    public did: string,
    public convoId: string,
  ) {}
  isRepo(): this is RepoSubject {
    return false
  }
  isRecord(): this is RecordSubject {
    return false
  }
  isMessage(): this is MessageSubject {
    return false
  }
  isConvo(): this is ConvoSubject {
    return true
  }
  info() {
    return {
      subjectType: 'chat.bsky.convo.defs#convoRef' as const,
      subjectDid: this.did,
      subjectUri: null,
      subjectCid: null,
      subjectBlobCids: null,
      subjectMessageId: null,
      subjectConvoId: this.convoId,
      meta: { convoId: this.convoId || undefined },
    }
  }
  lex(): $Typed<ConvoRef> {
    return {
      $type: 'chat.bsky.convo.defs#convoRef',
      did: this.did,
      convoId: this.convoId,
    }
  }
}
