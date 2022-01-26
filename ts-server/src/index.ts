import express from 'express'
import cors from 'cors'
import * as ucan from 'ucans'

// // WARNING: For demo only, do not actually store secret keys in plaintext.
// const SECRET_KEY = 'I0HyDksQcCRdJBGVuE78Ts34SzyF7+xNprEQw/IRa51OuFZQc5ugqfgjeWRMehyfr7A1vXICRoUD5kqVadsRHA=='
// const SERVER_KEY = ucan.EdKeypair.fromSecretKey(SECRET_KEY)
// const SERVER_DID = SERVER_KEY.did()

const app = express()
app.use(express.json())
app.use(cors())

