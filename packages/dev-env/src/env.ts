// NOTE: this file should be imported first, particularly before `@atproto/common` (for logging), to ensure that environment variables are respected in library code
import { config } from 'dotenv'

const env = process.env.ENV
if (env) {
  config({ path: `./.${env}.env` })
} else {
  config()
}
