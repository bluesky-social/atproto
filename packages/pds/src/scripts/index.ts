import { publishIdentity, publishIdentityFromFile } from './publish-identity.js'
import { rebuildRepoScript } from './rebuild-repo.js'
import {
  rotateKeys,
  rotateKeysFromFile,
  rotateKeysRecovery,
} from './rotate-keys.js'
import { sequencerRecovery } from './sequencer-recovery/index.js'
import { repairRepos } from './sequencer-recovery/repair-repos.js'

export const scripts = {
  'rebuild-repo': rebuildRepoScript,
  'sequencer-recovery': sequencerRecovery,
  'recovery-repair-repos': repairRepos,
  'rotate-keys': rotateKeys,
  'rotate-keys-file': rotateKeysFromFile,
  'rotate-keys-recovery': rotateKeysRecovery,
  'publish-identity': publishIdentity,
  'publish-identity-file': publishIdentityFromFile,
} satisfies Record<string, (ctx: any, args: string[]) => Promise<void>>
