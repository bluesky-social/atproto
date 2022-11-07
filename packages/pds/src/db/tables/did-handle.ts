export interface DidHandle {
  did: string
  handle: string
  actorType: string | null
  declarationCid: string | null
}

export const tableName = 'did_handle'

export type PartialDB = { [tableName]: DidHandle }
