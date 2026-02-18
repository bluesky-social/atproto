import * as _001 from './001-init'
import * as _002 from './002-blob_tempkey_idx-removal'

// @NOTE we currently do not support migrating the Actor DB.
// Since the _002 migration is more of an optimization, we can
// skip it for now. We can enable it later if needed.

export default {
  '001': _001,
  // '002': _002,
}
