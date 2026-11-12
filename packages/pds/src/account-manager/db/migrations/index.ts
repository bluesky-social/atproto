import * as mig001 from './001-init.js'
import * as mig002 from './002-account-deactivation.js'
import * as mig003 from './003-privileged-app-passwords.js'
import * as mig004 from './004-oauth.js'
import * as mig005 from './005-oauth-account-management.js'
import * as mig006 from './006-oauth-permission-sets.js'
import * as mig007 from './007-lexicon-failures-index.js'
import * as mig008 from './008-spaces.js'
import * as mig009 from './009-space-deletion-and-macs.js'
import * as mig010 from './010-space-status-notifications.js'
import * as mig011 from './011-account-email-auth-factor.js'

// @TODO fix before merging to main. This ordering only works for DBs created
// from the permissioned-data branch.
//
// main added the email auth factor as '008', which this branch already uses for
// spaces. Kysely tracks migrations by name only, so spaces alpha DBs (which
// recorded '008'-'010' as the spaces migrations) would fail to boot, or skip
// the email auth factor, if main's numbering were used. So the branch's 008-010
// stay as they were and main's '008' moves to '011'.
//
// Released main DBs already recorded '008' as the email auth factor and are NOT
// compatible with this ordering. Before merging, rewrite the spaces migrations
// to come after main's (e.g. squash 008-010 into a single '009-spaces').
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
}
