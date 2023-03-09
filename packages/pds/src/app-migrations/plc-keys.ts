import { Keypair } from '@atproto/crypto'
import * as plc from '@did-plc/lib'
import Database from '../db'
import { appMigration } from '../db/leader'

export const plcKeysMigration = async (
  db: Database,
  opts: {
    plcUrl: string
    oldSigningKey: Keypair
    plcRotationKey: Keypair
    repoSigningKey: Keypair
    recoveryKey: string
  },
) => {
  await appMigration(db, `2023-03-09-plc-keys`, async (dbTxn) => {
    await doMigration(dbTxn, opts)
  })
}

export const doMigration = async (
  db: Database,
  opts: {
    plcUrl: string
    oldSigningKey: Keypair
    plcRotationKey: Keypair
    repoSigningKey: Keypair
    recoveryKey: string
  },
) => {
  const plcClient = new plc.Client(opts.plcUrl)
  const { oldSigningKey, plcRotationKey, repoSigningKey, recoveryKey } = opts
  const res = await db.db.selectFrom('did_handle').select('did').execute()
  const dids = res.map((row) => row.did)
  const total = dids.length
  let count = 0
  for (const did of dids) {
    await plcClient.updateData(did, oldSigningKey, (lastOp) => ({
      ...lastOp,
      rotationKeys: [recoveryKey, plcRotationKey.did()],
      verificationMethods: {
        atproto: repoSigningKey.did(),
      },
    }))
    count++
    if (count % 10 === 0) {
      console.log(`plc key: ${count}/${total}`)
    }
  }
  console.log('plc key migration done')
}
