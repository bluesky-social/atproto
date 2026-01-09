import { com } from './lexicons/index.js'

export const didAndSeqForEvt = (
  evt: com.atproto.sync.subscribeRepos.Message,
): { did: string; seq: number } | undefined => {
  if (com.atproto.sync.subscribeRepos.commit.$isTypeOf(evt)) {
    return { seq: evt.seq, did: evt.repo }
  } else if (
    com.atproto.sync.subscribeRepos.account.$isTypeOf(evt) ||
    com.atproto.sync.subscribeRepos.identity.$isTypeOf(evt) ||
    com.atproto.sync.subscribeRepos.sync.$isTypeOf(evt)
  ) {
    return { seq: evt.seq, did: evt.did }
  }
  return undefined
}
