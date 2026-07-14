import { app } from '../lexicons.ts'
import { usePdsClient } from '../providers/PdsClientProvider.tsx'
import { useLexRecord } from '../queries/use-lex-record.ts'
import { Button } from './Button.tsx'
import { JsonQueryResult } from './JsonQueryResult.tsx'

export function ProfileInfo() {
  const client = usePdsClient()
  const result = useLexRecord(client, app.bsky.actor.profile)

  return (
    <div>
      <h2>
        Profile record
        <Button
          action={async () => result.refetch({ throwOnError: false })}
          className="ml-1"
          size="small"
          transparent
        >
          refresh
        </Button>
      </h2>
      <JsonQueryResult result={result} transform={(data) => data.value} />
    </div>
  )
}
