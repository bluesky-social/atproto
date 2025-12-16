import { app } from '../lexicons.ts'
import { useLexRecord } from '../queries/use-lex-record.ts'
import { Button } from './Button.tsx'
import { JsonQueryResult } from './JsonQueryResult.tsx'

export function ProfileInfo() {
  const result = useLexRecord(app.bsky.actor.profile)

  return (
    <div>
      <h2>
        Bluesky profile
        <Button
          action={async () => result.refetch({ throwOnError: false })}
          className="ml-1"
          size="small"
          transparent
        >
          refresh
        </Button>
      </h2>
      <JsonQueryResult result={result} />
    </div>
  )
}
