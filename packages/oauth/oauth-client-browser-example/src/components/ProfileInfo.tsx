import { useGetActorProfileQuery } from '../queries/use-get-actor-profile-query.ts'
import { JsonQueryResult } from './JsonQueryResult.tsx'
import { Button } from './_button.tsx'

export function ProfileInfo() {
  const result = useGetActorProfileQuery()

  return (
    <div>
      <h2>
        Bluesky profile
        <Button
          onClick={() => result.refetch({ throwOnError: false })}
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
