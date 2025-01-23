import { CidSet, formatDataKey } from '@atproto/repo'
import { CommitOp, PreparedCreate, PreparedWrite } from '../../repo'

export const blobCidsFromWrites = (writes: PreparedWrite[]): CidSet => {
  const blobCids = new CidSet()
  for (const w of writes) {
    if (w.action === 'create' || w.action === 'update') {
      for (const blob of w.blobs) {
        blobCids.add(blob.cid)
      }
    }
  }
  return blobCids
}

export const commitOpsFromCreates = (writes: PreparedCreate[]): CommitOp[] => {
  return writes.map((w) => ({
    action: 'create' as const,
    path: formatDataKey(w.uri.collection, w.uri.rkey),
    cid: w.cid,
  }))
}
