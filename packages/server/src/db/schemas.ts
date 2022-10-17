import { RecordSchemas } from '@adxp/lexicon'
import { recordSchemas } from '../lexicon/schemas'

export const records = new RecordSchemas()

for (const schema of recordSchemas) {
  records.add(schema)
}

export { ids } from '../lexicon/schemas'
