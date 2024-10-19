import { rebuildRepo } from './rebuild-repo'
import { sequencerRecovery } from './sequencer-recovery'
import { rotateKeys, rotateKeysMany } from './rotate-keys'
import { publishIdentity, publishIdentityMany } from './publish-identity'

export const scripts = {
  'rebuild-repo': rebuildRepo,
  'sequencer-recovery': sequencerRecovery,
  'rotate-keys': rotateKeys,
  'rotate-keys-many': rotateKeysMany,
  'publish-identity': publishIdentity,
  'publish-identity-many': publishIdentityMany,
}
