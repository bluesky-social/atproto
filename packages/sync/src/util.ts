import { RepoEvent, isAccount, isCommit, isIdentity } from './firehose/lexicons'

export const didAndSeqForEvt = (
  evt: RepoEvent,
): { did: string; seq: number } | undefined => {
  if (isCommit(evt)) return { seq: evt.seq, did: evt.repo }
  else if (isAccount(evt) || isIdentity(evt))
    return { seq: evt.seq, did: evt.did }
  return undefined
}
