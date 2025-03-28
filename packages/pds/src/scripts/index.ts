import { publishIdentity, publishIdentityMany } from './publish-identity'
import { rebuildRepo } from './rebuild-repo'
import { rotateKeys, rotateKeysMany, rotateKeysRecovery } from './rotate-keys'
import { sequencerRecovery } from './sequencer-recovery'
import { repairRepos } from './sequencer-recovery/repair-repos'

export const scripts = {
  'rebuild-repo': rebuildRepo,
  'sequencer-recovery': sequencerRecovery,
  'recovery-repair-repos': repairRepos,
  'rotate-keys': rotateKeys,
  'rotate-keys-many': rotateKeysMany,
  'rotate-keys-recovery': rotateKeysRecovery,
  'publish-identity': publishIdentity,
  'publish-identity-many': publishIdentityMany,
}
