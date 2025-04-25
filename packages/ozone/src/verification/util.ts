import { $Typed, ToolsOzoneModerationDefs } from '@atproto/api'
import { addAccountInfoToRepoViewDetail, getPdsAccountInfos } from '../api/util'
import { AppContext } from '../context'
import { ModerationService } from '../mod-service'
import { ParsedLabelers } from '../util'

export const getReposForVerifications = async (
  ctx: AppContext,
  labelers: ParsedLabelers,
  modService: ModerationService,
  dids: string[],
  isModerator: boolean,
) => {
  const [partialRepos, accountInfo] = await Promise.all([
    modService.views.repoDetails(dids, labelers),
    getPdsAccountInfos(ctx, dids),
  ])

  const repos = new Map<
    string,
    | $Typed<ToolsOzoneModerationDefs.RepoViewDetail>
    | $Typed<ToolsOzoneModerationDefs.RepoViewNotFound>
  >(
    dids.map((did) => {
      const partialRepo = partialRepos.get(did)
      if (!partialRepo) {
        return [
          did,
          {
            did,
            $type: 'tools.ozone.moderation.defs#repoViewNotFound',
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
          $type: 'tools.ozone.moderation.defs#repoViewDetail',
        },
      ]
    }),
  )

  return repos
}
