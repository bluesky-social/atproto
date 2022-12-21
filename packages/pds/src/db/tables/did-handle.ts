export interface DidHandle {
  did: string
  handle: string
  actorType: string
  declarationCid: string
  takedownId: number | null
}

export const tableName = 'did_handle'

export type PartialDB = { [tableName]: DidHandle }
