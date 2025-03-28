import { publishIdentity, publishIdentityFromFile } from './publish-identity'
import { rebuildRepo } from './rebuild-repo'
import {
  rotateKeys,
  rotateKeysFromFile,
  rotateKeysRecovery,
} from './rotate-keys'
import { sequencerRecovery } from './sequencer-recovery'
import { repairRepos } from './sequencer-recovery/repair-repos'

export const scripts = {
  'rebuild-repo': rebuildRepo,
  'sequencer-recovery': sequencerRecovery,
  'recovery-repair-repos': repairRepos,
  'rotate-keys': rotateKeys,
  'rotate-keys-file': rotateKeysFromFile,
  'rotate-keys-recovery': rotateKeysRecovery,
  'publish-identity': publishIdentity,
  'publish-identity-file': publishIdentityFromFile,
}
