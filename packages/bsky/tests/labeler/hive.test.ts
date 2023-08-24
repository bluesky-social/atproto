import fs from 'fs/promises'
import * as hive from '../../src/labeler/hive'

describe('labeling', () => {
  it('correctly parses hive responses', async () => {
    const exampleRespBytes = await fs.readFile(
      'tests/labeler/fixtures/hiveai_resp_example.json',
    )
    const exampleResp = JSON.parse(exampleRespBytes.toString())
    const classes = hive.respToClasses(exampleResp)
    expect(classes.length).toBeGreaterThan(10)

    const labels = hive.summarizeLabels(classes)
    expect(labels).toEqual(['porn'])
  })
})
