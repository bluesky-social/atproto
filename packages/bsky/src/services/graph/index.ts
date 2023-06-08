import Database from '../../db'
import { ImageUriBuilder } from '../../image/uri'
import { ProfileView } from '../../lexicon/types/app/bsky/actor/defs'
import { List } from '../../db/tables/list'
import { Selectable } from 'kysely'

export class GraphService {
  constructor(public db: Database, public imgUriBuilder: ImageUriBuilder) {}

  static creator(imgUriBuilder: ImageUriBuilder) {
    return (db: Database) => new GraphService(db, imgUriBuilder)
  }

  async muteActorList(info: {
    list: string
    mutedByDid: string
    createdAt?: Date
  }) {
    const { list, mutedByDid, createdAt = new Date() } = info
    await this.db.db
      .insertInto('list_mute')
      .values({
        listUri: list,
        mutedByDid,
        createdAt: createdAt.toISOString(),
      })
      .onConflict((oc) => oc.doNothing())
      .execute()
  }

  async unmuteActorList(info: { list: string; mutedByDid: string }) {
    const { list, mutedByDid } = info
    await this.db.db
      .deleteFrom('list_mute')
      .where('listUri', '=', list)
      .where('mutedByDid', '=', mutedByDid)
      .execute()
  }

  getListsQb(viewer: string | null) {
    const { ref } = this.db.db.dynamic
    return this.db.db
      .selectFrom('list')
      .innerJoin('actor', 'actor.did', 'list.creator')
      .selectAll('list')
      .selectAll('actor')
      .select('list.sortAt as sortAt')
      .select(
        this.db.db
          .selectFrom('list_mute')
          .where('list_mute.mutedByDid', '=', viewer ?? '')
          .whereRef('list_mute.listUri', '=', ref('list.uri'))
          .select('list_mute.listUri')
          .as('viewerMuted'),
      )
  }

  getListItemsQb() {
    return this.db.db
      .selectFrom('list_item')
      .innerJoin('actor as subject', 'subject.did', 'list_item.subjectDid')
      .selectAll('subject')
      .select(['list_item.cid as cid', 'list_item.sortAt as sortAt'])
  }

  formatListView(list: ListInfo, profiles: Record<string, ProfileView>) {
    return {
      uri: list.uri,
      creator: profiles[list.creator],
      name: list.name,
      purpose: list.purpose,
      description: list.description ?? undefined,
      descriptionFacets: list.descriptionFacets
        ? JSON.parse(list.descriptionFacets)
        : undefined,
      avatar: list.avatarCid
        ? this.imgUriBuilder.getCommonSignedUri(
            'avatar',
            list.creator,
            list.avatarCid,
          )
        : undefined,
      indexedAt: list.indexedAt,
      viewer: {
        muted: !!list.viewerMuted,
      },
    }
  }
}

type ListInfo = Selectable<List> & {
  viewerMuted: string | null
}
