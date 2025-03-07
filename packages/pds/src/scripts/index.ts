import { publishIdentity, publishIdentityMany } from './publish-identity'
import { rebuildRepo } from './rebuild-repo'
import { rotateKeys, rotateKeysMany } from './rotate-keys'
import { sequencerRecovery } from './sequencer-recovery'

export const scripts = {
  'rebuild-repo': rebuildRepo,
  'sequencer-recovery': sequencerRecovery,
  'rotate-keys': rotateKeys,
  'rotate-keys-many': rotateKeysMany,
  'publish-identity': publishIdentity,
  'publish-identity-many': publishIdentityMany,
}
