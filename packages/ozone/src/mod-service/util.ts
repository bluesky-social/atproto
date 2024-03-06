import { LabelRow } from '../db/schema/label'
import { Label } from '../lexicon/types/com/atproto/label/defs'

export const formatLabel = (row: LabelRow): Label => {
  const label: Label = {
    src: row.src,
    uri: row.uri,
    val: row.val,
    neg: row.neg,
    cts: row.cts,
  }
  if (row.cid !== '') {
    // @NOTE avoiding undefined values on label, which dag-cbor chokes on when serializing.
    label.cid = row.cid
  }
  return label
}
