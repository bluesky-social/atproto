import type { $Typed, DidString } from '@atproto/lex'
import {
  addAccountInfoToRepoViewDetail,
  getPdsAccountInfos,
} from '../api/util.js'
import type { AppContext } from '../context.js'
import type { tools } from '../lexicons/index.js'
import type { ModerationService } from '../mod-service/index.js'
import type { ParsedLabelers } from '../util.js'

export const getReposForVerifications = async (
  ctx: AppContext,
  labelers: ParsedLabelers,
  modService: ModerationService,
  dids: DidString[],
  isModerator: boolean,
) => {
  const [partialRepos, accountInfo] = await Promise.all([
    modService.views.repoDetails(dids, labelers),
    getPdsAccountInfos(ctx, dids),
  ])

  const repos = new Map<
    string,
    | $Typed<tools.ozone.moderation.defs.RepoViewDetail>
    | $Typed<tools.ozone.moderation.defs.RepoViewNotFound>
  >(
    dids.map((did) => {
      const partialRepo = partialRepos.get(did)
      if (!partialRepo) {
        return [
          did,
          {
            did,
            $type: 'tools.ozone.moderation.defs#repoViewNotFound' as const,
          },
        ]
      }
      return [
        did,
        {
          ...addAccountInfoToRepoViewDetail(
            partialRepo,
            accountInfo.get(did) || null,
            isModerator,
          ),
          $type: 'tools.ozone.moderation.defs#repoViewDetail' as const,
        },
      ]
    }),
  )

  return repos
}
