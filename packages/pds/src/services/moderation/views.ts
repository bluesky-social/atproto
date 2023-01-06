import { ipldBytesToRecord } from '@atproto/common'
import Database from '../../db'
import { DidHandle } from '../../db/tables/did-handle'
import { RepoRoot } from '../../db/tables/repo-root'
import { View as RepoView } from '../../lexicon/types/com/atproto/admin/repo'

export class ModerationViews {
  constructor(private db: Database) {}

  repo(result: RepoResult): Promise<RepoView>
  repo(result: RepoResult[]): Promise<RepoView[]>
  async repo(
    result: RepoResult | RepoResult[],
  ): Promise<RepoView | RepoView[]> {
    const results = Array.isArray(result) ? result : [result]
    if (results.length === 0) return []

    const info = await this.db.db
      .selectFrom('did_handle')
      .leftJoin('user', 'user.handle', 'did_handle.handle')
      .leftJoin('profile', 'profile.creator', 'did_handle.did')
      .leftJoin(
        'ipld_block as profile_block',
        'profile_block.cid',
        'profile.cid',
      )
      .leftJoin(
        'ipld_block as declaration_block',
        'declaration_block.cid',
        'did_handle.declarationCid',
      )
      .where(
        'did_handle.did',
        'in',
        results.map((r) => r.did),
      )
      .select([
        'did_handle.did as did',
        'user.email as email',
        'profile_block.content as profileBytes',
        'declaration_block.content as declarationBytes',
      ])
      .execute()

    const infoByDid = info.reduce(
      (acc, cur) => Object.assign(acc, { [cur.did]: cur }),
      {} as Record<string, ArrayEl<typeof info>>,
    )

    const views = results.map((r) => {
      const { email, declarationBytes, profileBytes } = infoByDid[r.did]
      const relatedRecords: object[] = []
      if (declarationBytes) {
        relatedRecords.push(ipldBytesToRecord(declarationBytes))
      }
      if (profileBytes) {
        relatedRecords.push(ipldBytesToRecord(profileBytes))
      }
      return {
        did: r.did,
        handle: r.handle,
        account: email ? { email } : undefined,
        relatedRecords,
        indexedAt: r.indexedAt,
        moderation: { takedownId: r.takedownId ?? undefined },
      }
    })

    return Array.isArray(result) ? views : views[0]
  }
}

type RepoResult = DidHandle & RepoRoot

type ArrayEl<A> = A extends readonly (infer T)[] ? T : never
