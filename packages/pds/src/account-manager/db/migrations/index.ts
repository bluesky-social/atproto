import * as mig001 from './001-init'
import * as mig002 from './002-account-deactivation'
import * as mig003 from './003-privileged-app-passwords'
import * as mig004 from './004-oauth'
import * as mig005 from './005-oauth-account-management'
import * as mig006 from './006-oauth-permission-sets'
import * as mig007 from './007-lexicon-failures-index'
import * as mig008 from './008-neuro-identity'
import * as mig009 from './009-nullable-password'
import * as mig010 from './010-neuro-provision-nonce'
import * as mig011 from './011-pending-invitations'
import * as mig012 from './012-invitation-tracking'

export default {
  '001': mig001,
  '002': mig002,
  '003': mig003,
  '004': mig004,
  '005': mig005,
  '006': mig006,
  '007': mig007,
  '008': mig008,
  '009': mig009,
  '010': mig010,
  '011': mig011,
  '012': mig012,
}
