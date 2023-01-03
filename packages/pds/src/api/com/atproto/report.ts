import { CID } from 'multiformats/cid'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { AtUri } from '@atproto/uri'
import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import { ModerationReport } from '../../../db/tables/moderation'
import { InputSchema as ReportInput } from '../../../lexicon/types/com/atproto/report/create'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.report.create({
    auth: ctx.accessVerifierCheckTakedown,
    handler: async ({ input, auth }) => {
      const { db, services } = ctx
      const { reasonType, reason, subject } = input.body
      const requester = auth.credentials.did

      const repoService = services.repo(db)

      const report = await repoService.report({
        reasonType: getReasonType(reasonType),
        reason,
        subject: getSubject(subject),
        reportedByDid: requester,
      })

      return {
        encoding: 'application/json',
        body: repoService.formatReportView(report),
      }
    },
  })
}

function getReasonType(reasonType: ReportInput['reasonType']) {
  if (
    reasonType === 'com.atproto.report.reason#spam' ||
    reasonType === 'com.atproto.report.reason#other'
  ) {
    return reasonType as ModerationReport['reasonType']
  }
  throw new InvalidRequestError('Invalid reason type')
}

function getSubject(subject: ReportInput['subject']) {
  if (
    subject.$type === 'com.atproto.report.subject#repo' &&
    typeof subject.did === 'string'
  ) {
    return { did: subject.did }
  }
  if (
    subject.$type === 'com.atproto.report.subject#record' &&
    typeof subject.did === 'string' &&
    typeof subject.collection === 'string' &&
    typeof subject.rkey === 'string' &&
    (subject.cid === undefined || typeof subject.cid === 'string')
  ) {
    return {
      uri: AtUri.make(subject.did, subject.collection, subject.rkey),
      cid: subject.cid ? parseCID(subject.cid) : undefined,
    }
  }
  throw new InvalidRequestError('Invalid subject')
}

function parseCID(cid: string) {
  try {
    return CID.parse(cid)
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new InvalidRequestError('Invalid cid')
    }
    throw err
  }
}
