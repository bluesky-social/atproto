export type Account = {
  seq: number
  did: string
  time: string
  active: boolean
  status?:
    | 'takendown'
    | 'suspended'
    | 'deleted'
    | 'deactivated'
    | (string & NonNullable<unknown>)
  [k: string]: unknown
}
