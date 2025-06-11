#!/usr/bin/env ts-node

import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export async function main() {
  const now = new Date()
  const prefix = now.toISOString().replace(/[^a-z0-9]/gi, '') // Order of migrations matches alphabetical order of their names
  const name = process.argv[2]
  if (!name || !name.match(/^[a-z0-9-]+$/)) {
    process.exitCode = 1
    return console.error(
      'Must pass a migration name consisting of lowercase digits, numbers, and dashes.',
    )
  }
  const filename = `${prefix}-${name}`
  const dir = path.join(
    __dirname,
    '..',
    'src',
    'data-plane',
    'server',
    'db',
    'migrations',
  )

  await fs.writeFile(path.join(dir, `${filename}.ts`), template, { flag: 'wx' })
  await fs.writeFile(
    path.join(dir, 'index.ts'),
    `export * as _${prefix} from './${filename}'\n`,
    { flag: 'a' },
  )
}

const template = `import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // Migration code
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Migration code
}
`

main()
