const tableName = 'op_thread_reply'

// Denormalized OP replies per thread, mirroring the production dataplane's
// op_thread_replies table. Rows are soft deleted (deletedAt) rather than
// removed so the OP thread walk can still route through a deleted reply to
// replies that outlive it.
export interface OpThreadReply {
  rootUri: string
  parentUri: string
  uri: string
  deletedAt: string | null
}

export type PartialDB = { [tableName]: OpThreadReply }
