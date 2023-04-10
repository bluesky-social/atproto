import fsSync from 'fs'
import fs from 'fs/promises'
import * as hive from '../src/labeler/hive'

const API_KEY = 't1nrMkeQRRCtxJiYOH9HtAjPJh2dAe1N'

describe('labeling', () => {
  it('correclty parses hive responses', async () => {
    const exampleRespBytes = await fs.readFile(
      'tests/fixtures/hiveai_resp_example.json',
    )
    const exmapleResp = JSON.parse(exampleRespBytes.toString())
    const classes = hive.respToClasses(exmapleResp)
    expect(classes.length).toBeGreaterThan(10)

    const labels = hive.summarizeLabels(classes)
    expect(labels).toEqual(['porn'])
  })

  it('works', async () => {
    const stream = await fsSync.createReadStream('tests/image/fixtures/at.png')
    const labels = await hive.labelBlob(stream, API_KEY)
  })
})
