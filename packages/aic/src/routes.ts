import express from 'express'

const router = express.Router()
router.use(express.static('static'))

router.all('/tid', async (req, res) => {
  res.sendStatus(501)
})

// Get a DID doc
router.get(`/:did`, async function (req, res) {
  res.sendStatus(501)
})

// Get a DID tick
router.get(`/:did`, async function (req, res) {
  res.sendStatus(501)
})

// Update or create a DID doc
router.post(`/:did`, async function (req, res) {
  res.sendStatus(501)
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
