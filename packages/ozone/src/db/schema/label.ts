import type { Generated, Selectable } from 'kysely'
import type { DatetimeString, DidString, UriString } from '@atproto/lex'

export const tableName = 'label'

export interface Label {
  id: Generated<number>
  src: DidString
  uri: UriString
  cid: string
  val: string
  neg: boolean
  cts: DatetimeString
  exp: DatetimeString | null
  sig: Buffer | null
  signingKeyId: number | null
}

export type LabelRow = Selectable<Label>

export type PartialDB = { [tableName]: Label }

export const LabelChannel = 'label_channel' // used with notify/listen
