import express from 'express'
import * as locals from './locals'
import * as document from './document'
import { check } from '@adxp/common'
import * as t from './types'
import { ServerError } from './error'

const router = express.Router()
router.use(express.static('static'))

// Get a DID doc
router.get(`/:did`, async function (req, res) {
  const { did } = req.params
  const { db } = locals.get(res)
  const log = await db.opsForDid(did)
  if (log.length === 0) {
    throw new ServerError(404, `DID not registered: ${did}`)
  }
  const doc = await document.validateOperationLog(did, log)
  res.send(doc)
})

// Get operation log for a DID
router.get(`/log/:did`, async function (req, res) {
  const { did } = req.params
  const { db } = locals.get(res)
  const log = await db.opsForDid(did)
  if (log.length === 0) {
    throw new ServerError(404, `DID not registered: ${did}`)
  }
  res.send({ log })
})

// Update or create a DID doc
router.post(`/:did`, async function (req, res) {
  const { did } = req.params
  const op = req.body
  if (!check.is(op, t.def.operation)) {
    throw new Error('Not a valid operation')
  }
  const { db } = locals.get(res)
  await db.validateAndAddOp(did, op)
  res.sendStatus(200)
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
