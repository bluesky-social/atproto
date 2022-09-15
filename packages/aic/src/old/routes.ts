import express from 'express'
import { tid } from './tid'
import { tickToDidDoc, updateTick } from './document'
import { sign } from './signature'
import * as locals from './locals'

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
// router.use('/favicon.ico', express.static('static/favicon.ico'))
router.use(express.static('static'))

const pidMatch = '[234567abcdefghijklmnopqrstuvwxyz]{16}'

router.all('/tid', async (req, res) => {
  const { keypair } = locals.get(res)
  res.send(
    await sign(
      {
        tid: tid(),
        key: keypair.did(),
        sig: '',
      },
      keypair,
    ),
  )
})

// Get a DID doc
router.get(`/:pid(${pidMatch})`, async function (req, res) {
  const { db, keypair } = locals.get(res)

  const did = 'did:aic:' + req.params.pid
  const row = await db.tickForDid(did) // retrieve latest tick
  const prevTick = row ? JSON.parse(row.tick) : null
  const now = tid()
  const signedDoc = await updateTick(
    did,
    now,
    null, // candidateDiff: this is a get no updates
    prevTick,
    keypair,
  )

  const didDoc = await tickToDidDoc(signedDoc, keypair.did(), keypair, now)

  res.type('json').send(didDoc)
})

// Get a DID tick
router.get(`/:pid(${pidMatch})/tick`, async function (req, res) {
  const { db, keypair } = locals.get(res)
  // AIC get
  //
  // Retrieve the latest tick from the database
  // pass the tick and current tid to the aic lib for signing
  const did = 'did:aic:' + req.params.pid
  const row = await db.tickForDid(did) // retrieve latest tick
  const prevTick = row ? JSON.parse(row.tick) : null
  const signedDoc = await updateTick(
    did,
    tid(),
    null, // candidateDiff: this is a get no updates
    prevTick,
    keypair,
  )
  res.type('json').send(signedDoc)
})

// Update or create a DID doc
router.post(`/:pid(${pidMatch})`, async function (req, res) {
  const { db, keypair } = locals.get(res)

  // extract from post
  const did = 'did:aic:' + req.params.pid
  const candidateDiff = req.body // @TODO add input validation with zod

  // extract from DB
  const row = await db.tickForDid(did)
  const prevTid = row ? row.tid : null
  const prevTick = row ? JSON.parse(row.tick) : null

  // aic lib will do the doc update
  // @TODO distinguish any errors whose reasoning we can share with the user,
  // make them non-500s. Also, consider using bounce to hard-throw system errors.
  const newTick = await updateTick(
    did, // did from the URL
    tid(), // current time (tid)
    candidateDiff, // diff that was posted/put
    prevTick, // tick from db for did:aic
    keypair, // server's aic key
  )

  await db.putTickForDid(
    newTick.did,
    newTick.tid,
    prevTid, // gard: if the prevTid has changed the tick from the db is stale
    JSON.stringify(newTick),
  )

  // we reload the tick from the database if the put failed/pending we return the last tick
  const result = await db.tickForDid(did)
  if (result === null) {
    throw new Error(
      'tick should exist since it was just successfully updated, but does not',
    )
  }

  res.status(200)
  res.type('json').send(result.tick)
})

router.get('/lobby', async (req, res) => {
  res.send(`
  <html>
    <head>
      <title>AIC Lobby</title>
    </head>
    <body>
      hello lobby
      <form action="#" id="">
        Did Doc: <input type="text" name="init" id="doc">
        <input type="button" value="look up" id="btn">
      </form>
      <script type="text/javascript">
        function run() {
          alert(document.getElementById('doc').value)
        }
        document.getElementById('btn').onclick = run;
      </script>
    </body>
  </html>
  `)
})

export default router
