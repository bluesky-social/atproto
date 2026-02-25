#!/usr/bin/env node
/* eslint-env node */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { URL, fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const distPath = resolve(__dirname, '../dist/bin.js')

try {
  const content = readFileSync(distPath, 'utf-8')
  const firstLine = content.split('\n')[0]

  if (firstLine !== '#!/usr/bin/env node') {
    console.error('ERROR: First line of bin.js is not "#!/usr/bin/env node"')
    console.error(`Found: "${firstLine}"`)
    process.exit(1)
  }

  console.log('SUCCESS: bin.js has correct shebang')
  process.exit(0)
} catch (error) {
  console.error('ERROR: Could not read bin.js', error.message)
  process.exit(1)
}
