import * as mig001 from './001-init'
import * as mig002 from './002-account-deactivation'
import * as mig003 from './003-privileged-app-passwords'
import * as mig004 from './004-oauth'
import * as mig005 from './005-oauth-account-management'
import * as mig006 from './006-oauth-permission-sets'
import * as mig007 from './007-lexicon-failures-index'

export default {
  '001': mig001,
  '002': mig002,
  '003': mig003,
  '004': mig004,
  '005': mig005,
  '006': mig006,
  '007': mig007,
}
