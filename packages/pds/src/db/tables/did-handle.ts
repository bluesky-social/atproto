// @NOTE also used by app-view
export interface DidHandle {
  did: string
  handle: string
  takedownId: number | null
}

export const tableName = 'did_handle'

export type PartialDB = { [tableName]: DidHandle }
