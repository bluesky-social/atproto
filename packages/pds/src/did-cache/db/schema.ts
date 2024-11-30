export interface DidDoc {
  did: string
  doc: string // json representation of DidDocument
  updatedAt: number
}

export type DidCacheSchema = {
  did_doc: DidDoc
}
