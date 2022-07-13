import express from 'express'
import tid from './tid'
import { TID } from '@adxp/common'
import { update_tick } from '@adxp/aic'
import * as crypto from '@adxp/crypto'
import { z } from 'zod'

// Note: do not use the dev/test key in production
//       pull the prod key from the secret store
export const CONSORTIUM_KEYPAIR = crypto.EcdsaKeypair.import(
  {
    // did:key:zDnaeeL44gSLMViH9khhTbngNd9r72MhUPo4WKPeSfB8xiDTh
    key_ops: [ 'sign' ],
    ext: true,
    kty: 'EC',
    x: 'zn_OWx4zJM5zy8E_WUAJH9OS75K5t6q74D7lMf7AmnQ',
    y: 'trzc_f9i_nOuYRCLMyXxBcpc3OVlylmxdESQ0zdKHeQ',
    crv: 'P-256',
    d: 'Ii__doqqQ5YYZLfKh-LSh1Vm6AqCWHGMrBTDYKaEWfU',
  },
  {
    exportable: true,
  },
)

// const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
// type Literal = z.infer<typeof literalSchema>
// type Json = Literal | { [key: string]: Json } | Json[]
// const jsonSchema: z.ZodType<Json> = z.lazy(() =>
//   z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)]),
// )

// const Patch = z.tuple([
//   z.literal('put').or(z.literal('del')),
//   z.string().array(),
//   jsonSchema,
// ])
// type Patch = z.infer<typeof Patch>

// const Diff = z.object({
//   prev: z.string().regex(/[2-7a-z]{4}-[2-7a-z]{3}-[2-7a-z]{4}-[2-7a-z]{2}/),
//   patches: Patch.array(),
//   // base58btc alphabet 123456789 ABCDEFGH JKLMN PQRSTUVWXYZ abcdefghijk mnopqrstuvwxyz
//   key: z.string().regex(/did:key:z[1-9A-HJ-NP-Za-km-z]+/),
//   sig: z.string().regex(/z[1-9A-HJ-NP-Za-km-z]+/),
// })
// type Diff = z.infer<typeof Diff>

const router = express.Router()

router.use('/tid', tid)

router.get(
  '/:pid([234567abcdefghijklmnopqrstuvwxyz]{16})/',
  async function (req, res) {
    // AIC git
    //
    // Retreve the latest tick from the databace
    // pass the tick and curent tid to the aic lib for signing
    const did = 'did:aic:' + req.params.pid
    const row = await res.locals.db.tick_for_did(did) // retreve latest tick
    const prev_tick = row ? JSON.parse(row.tick) : null
    const signed_doc = await update_tick(
      did,
      TID.next(),
      null, // candidate_diff: this is a get no updates
      prev_tick,
      await CONSORTIUM_KEYPAIR,
    )
    res.type('json').send(signed_doc)
  },
)

router.post(
  '/:pid([234567abcdefghijklmnopqrstuvwxyz]{16})/',
  async function (req, res) {
    // extract from post
    const did = 'did:aic:' + req.params.pid
    const candidate_diff = req.body

    // extract from DB
    const row = await res.locals.db.tick_for_did(did)
    const prev_tid = row ? row.tid : null
    const prev_tick = row ? JSON.parse(row.tick) : null

    // aic lib will do the doc update
    const new_tick = await update_tick(
      did, // did from the URL
      TID.next(), // curent time (tid)
      candidate_diff, // diff that was posted/put
      prev_tick, // tick from db for did:aic
      await CONSORTIUM_KEYPAIR, // server's aic key
    )

    if ('error' in new_tick) {
      // error return from update_tick
      // type ErrorMessage = { error: string; cause?: ErrorMessage; [index: string]: Value }
      // if there is an error property it is an error don't store in DB
      // also send the last tick that is still valid
      res.status(200)
      res.type('json').send({
        tid: TID.next().formatted(),
        did: `did:aic:${req.params.pid}`,
        tick: prev_tick,
        error: 'error return from update_tick',
        cause: new_tick,
      })
      return
    }

    // if the output of update_tick is not an error put in db
    console.log(`Saving ${new_tick.did} to AIC at ${new_tick.tid}`)
    res.locals.db.put_tick_for_did(
      new_tick.did,
      new_tick.tid,
      prev_tid, // gard: if the prev_tid has changed the tick from the db is stale
      JSON.stringify(new_tick),
    )

    res.status(200)
    res.type('json').send(new_tick)
  },
)

export default router
