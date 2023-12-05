import { Selectable } from 'kysely'
import { List } from '../../db/tables/list'

export type ListInfo = Selectable<List> & {
  viewerMuted: string | null
  viewerListBlockUri: string | null
  viewerInList: string | null
}

export type ListInfoMap = Record<string, ListInfo>
