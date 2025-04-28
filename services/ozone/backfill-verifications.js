/* eslint-env node */

'use strict'

import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { Database, envToCfg, readEnv } from '@atproto/ozone'

const CHUNK_SIZE = 100

async function processVerificationData(
  filePath,
  chunkProcessor = async (chunk) => chunk,
  options = {},
) {
  if (!filePath) {
    throw new Error('File path is required')
  }

  const resolvedPath = path.resolve(filePath)

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`)
  }

  const startLine = options.startLine || 1

  try {
    console.log(`Reading file: ${resolvedPath}`)
    const fileContent = fs.readFileSync(resolvedPath, { encoding: 'utf8' })

    const lines = fileContent
      .split('\n')
      .filter((line) => line.trim().length > 0)
    console.log(`Total lines in file: ${lines.length}`)

    const linesToProcess = lines.slice(startLine - 1)
    console.log(
      `Processing ${linesToProcess.length} lines starting from line ${startLine}`,
    )

    let processedCount = 0
    let currentLineNumber = startLine - 1

    for (let i = 0; i < linesToProcess.length; i += CHUNK_SIZE) {
      const chunk = []
      const currentChunk = linesToProcess.slice(i, i + CHUNK_SIZE)

      for (const line of currentChunk) {
        try {
          currentLineNumber++
          const row = parseCSVLine(line)
          chunk.push(row)
        } catch (error) {
          throw new Error(
            `Error processing line ${currentLineNumber}: ${error.message}\nLine content: ${line}`,
          )
        }
      }

      if (chunk.length > 0) {
        console.log(`Processing lines ${startLine + i} to ${currentLineNumber}`)

        await chunkProcessor([...chunk])
        processedCount += chunk.length

        console.log(
          `Processed ${processedCount} rows. Current line: ${currentLineNumber}`,
        )
      }
    }

    console.log(`Finished processing ${processedCount} total rows`)
    console.log(`Last processed line number: ${currentLineNumber}`)
    console.log(
      `To resume from this point, use --start-line=${currentLineNumber + 1}`,
    )

    return processedCount
  } catch (error) {
    console.error(error)
    throw error
  }
}

function parseCSVLine(line) {
  const [issuer, rkey, subject, cid, recordHex, createdAt, updatedAt] =
    line.split(',')

  const hexValue = recordHex.startsWith('0x') ? recordHex.slice(2) : recordHex
  const recordStr = Buffer.from(hexValue, 'hex').toString('utf8')
  const recordJson = JSON.parse(recordStr)

  const { handle, displayName } = recordJson

  return {
    issuer,
    uri: `at://${issuer}/app.bsky.graph.verification/${rkey}`,
    subject,
    cid,
    createdAt,
    handle,
    displayName,
    updatedAt,
  }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    let filePath = null
    let startLine = 1

    for (let i = 0; i < args.length; i++) {
      if (args[i].startsWith('--start-line=')) {
        startLine = parseInt(args[i].split('=')[1], 10)
      } else if (!filePath) {
        filePath = args[i]
      }
    }

    if (!filePath) {
      console.error(
        'Usage: node backfill-verifications.js <file_path> [--start-line=<line_number>]',
      )
      process.exit(1)
    }

    const env = readEnv()
    const cfg = envToCfg(env)
    const db = new Database({
      // @NOTE: locally used: postgresql://pg:password@127.0.0.1:5433/postgres
      url: cfg.db.postgresUrl,
      // @NOTE: locally used: ozone_db
      schema: cfg.db.postgresSchema,
    })

    console.log(
      `Processing file: ${filePath}${startLine > 1 ? ` starting from line ${startLine}` : ''}`,
    )

    await processVerificationData(
      filePath,
      async (chunk) => {
        return db.db
          .insertInto('verification')
          .values(chunk)
          .onConflict((oc) => oc.doNothing())
          .returningAll()
          .execute()
      },
      { startLine },
    )
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

main()
