# Report-Based Moderation Queue Architecture

## Problem Statement

Current moderation flow aggregates all reports at the subject level, causing:
- **No report type specialization**: Moderators can't focus on specific report types
- **Lost attribution**: When moderators action a subject, there's no link between the action and the report(s) that triggered it
- **Analytics gaps**: Can't track which report types lead to which actions, or measure moderator performance by report type
- **Lack of queue control**: No ability to create filter based queues and have policy specialized moderators process specific report type based queue.

## Proposed Solution

Introduce a **report-centric workflow** where moderators review and action individual reports while maintaining the ability to bulk-close related reports. Key architectural decisions:

1. **New `report` table** - Bridges report events to action events, enabling report→action attribution
2. **Dynamic queue routing** - Incoming reports get routed to predefined queues based on filtering conditions allowing us to assign
3. **Associate actions with reports** - Array of action event IDs, supporting iterative moderation (label → email → takedown → reverse)
4. **Reporter communication** - Moderators can send individual notes/communication to reporters when actioning

## Data Model Changes

### New Table: `report`

```sql
CREATE TABLE report (
  id SERIAL PRIMARY KEY,

  -- Core link to report event (all metadata comes from there via JOIN)
  event_id INTEGER NOT NULL UNIQUE REFERENCES moderation_event(id),

  -- Queue assignment (computed by background job)
  queue_id INTEGER, -- NULL = not yet assigned, -1 = no matching queue
  queued_at TIMESTAMP, -- When queue was assigned

  -- Action linkage (sorted DESC, most recent first)
  action_event_ids INTEGER[], -- Sorted array: [newest_id, ..., oldest_id]

  -- Reporter communication
  action_note TEXT, -- Note sent to reporter when actioning

  -- Status of the ticket/report
  status VARCHAR, -- "open", "closed", "escalated"

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_report_event FOREIGN KEY (event_id) REFERENCES moderation_event(id)
);

-- Indexes
CREATE INDEX idx_report_event ON report(event_id);
CREATE INDEX idx_report_queue_unassigned ON report(id) WHERE queue_name IS NULL; -- For background job
CREATE INDEX idx_report_queue_status ON report(queue_id, status, created_at DESC);
```

**Queue assignment flow:**
1. Report created with `queue_id = NULL`
2. Background job finds unassigned reports, computes queue, updates `queue_id` and `queued_at`
3. If no queue matches, set `queue_id = -1`
4. Manual reassignment possible via admin action

### Table: `report_queue` (Configuration)

Queue configuration table with uniqueness constraints to ensure one report → one queue.

```sql
CREATE TABLE report_queue (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE, -- Visual display name

  -- Queue filters (determine assignment)
  subject_types VARCHAR[] NOT NULL, -- ['account'] or ['record'] or ['account', 'record']
  collection VARCHAR, -- Collection name (first fragment of recordPath), NULL for accounts
  report_types VARCHAR[] NOT NULL, -- reasonTypes to include (e.g., ['tools.ozone.report.defs#reasonSpam'])

  -- Metadata
  created_by VARCHAR NOT NULL, -- DID of mod who created queue
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  enabled BOOLEAN DEFAULT true,

  -- Ensure no overlapping queue configurations
  -- This prevents: Queue A = [account, spam] and Queue B = [account, record, spam]
  CONSTRAINT unique_queue_config UNIQUE (subject_types, collection, report_types)
);

CREATE INDEX idx_queue_enabled ON report_queue(enabled);
CREATE INDEX idx_queue_lookup ON report_queue(enabled, subject_types, report_types) WHERE enabled = true;
```

**Uniqueness constraint rationale:**
- Ensures one report can only match one queue
- Prevents ambiguous assignment (Queue A = [harassment, account] vs Queue B = [harassment, account, record])
- `subject_types`, `collection`, `report_types` combo must be unique

### Table: `report_queue_stats` (Materialized Stats)

Real-time stats for queue management dashboard, updated by trigger on report changes.

```sql
CREATE TABLE report_queue_stats (
  queue_name VARCHAR PRIMARY KEY REFERENCES report_queue(name) ON DELETE CASCADE,

  -- Report counts by state
  pending_count INTEGER DEFAULT 0, -- action_event_ids IS NULL
  actioned_count INTEGER DEFAULT 0, -- action_event_ids IS NOT NULL
  escalated_pending_count INTEGER DEFAULT 0, -- escalated AND pending

  -- Unique entity counts
  unique_reporters_count INTEGER DEFAULT 0, -- COUNT(DISTINCT reported_by)
  unique_subjects_did_count INTEGER DEFAULT 0, -- COUNT(DISTINCT subject_did)
  unique_subjects_full_count INTEGER DEFAULT 0, -- COUNT(DISTINCT subject_did || subject_uri)

  -- Timestamps
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queue_stats_updated ON report_queue_stats(last_updated);
```

**Update strategy:** Trigger on `report` INSERT/UPDATE recomputes stats incrementally.

### Redis: `report_review_session` (Ephemeral)

For real-time "in review" status without DB writes:

```
Key: report:in_review:{reportId}
Value: { moderatorDid, moderatorHandle, startedAt }
TTL: 5 minutes (auto-expires if mod closes tab)
```

## New Lexicons

### Quick Reference: Modified `emitEvent`

**New optional parameter:**
- `reportAction?: { ids?: number[], types?: string[], all?: boolean, note?: string }`
  - `ids` - Target specific report IDs
  - `types` - Target reports matching these types on the subject
  - `all` - Target ALL reports on the subject (any type)
  - `note` - Message to send to affected reporter(s)

**Examples:**
```typescript
// Acknowledge specific reports with custom note to all reporters with those ids
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
  subject,
  reportAction: { ids: [1,2,3], note: 'No violation' }
})

// Takedown + action all spam reports on the subject being actioned
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventTakedown', ... },
  subject,
  reportAction: { types: ['tools.ozone.report.defs#reasonSpam'], note: 'Action taken' }
})

// Escalate one report
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventEscalate' },
  subject,
  reportAction: { ids: [123] }
})

// Action ALL reports on a subject with given
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
  subject,
  reportAction: { all: true, note: 'Account taken down' }
})
```

---

### `tools.ozone.moderation.queryReports`

Query endpoint for retrieving individual reports with filtering and pagination support.

See full lexicon definition: [lexicons/tools/ozone/moderation/queryReports.json](lexicons/tools/ozone/moderation/queryReports.json)

### Extended `tools.ozone.moderation.emitEvent`

**Add optional report-level parameter to existing `emitEvent` input schema:**

The existing lexicon at [lexicons/tools/ozone/moderation/emitEvent.json](lexicons/tools/ozone/moderation/emitEvent.json) should be extended with:

**New input property:**
```json
"reportAction": {
  "type": "ref",
  "ref": "#reportAction",
  "description": "Optional report-level targeting. If provided, this event will be linked to specific reports and reporters may be notified."
}
```

**New definition in emitEvent.json defs:**
```json
"reportAction": {
  "type": "object",
  "description": "Target specific reports when emitting a moderation event",
  "properties": {
    "ids": {
      "type": "array",
      "items": { "type": "integer" },
      "description": "Target specific report IDs"
    },
    "types": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Target reports matching these report types on the subject (fully qualified NSIDs)"
    },
    "all": {
      "type": "boolean",
      "description": "Target ALL reports on the subject"
    },
    "note": {
      "type": "string",
      "description": "Note to send to reporter(s) when actioning their report"
    }
  }
}
```

**Behavior:**
- **If `reportAction` provided**: Report-level action
  - Update specified/filtered reports with action event ID
  - Send `note` to affected reporters
  - Update report `status` based on event type
  - Link reports to the created moderation event
- **If NOT provided**: Subject-level action (existing behavior)
  - No report updates
  - Works as it does today

**Status transitions based on event type:**
- `modEventAcknowledge`, `modEventTakedown`, `modEventLabel` → `status = 'closed'`
- `modEventEscalate` → `status = 'escalated'`
- `modEventComment` (with `reportAction`) → `status = 'closed'` (dismissed)

**Examples:**

```typescript
// 1. Action specific reports
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:123' },
  reportAction: { ids: [101, 102, 103], note: 'Reviewed, no violation found' },
  createdBy: 'did:mod',
})
// → Acknowledges 3 reports, sets status='closed', doesn't change subject reviewState

// 2. Action all reports of certain types on a subject
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:123' },
  reportAction: {
    types: ['tools.ozone.report.defs#reasonSpam'],
    note: 'Action taken on reported content'
  },
  comment: 'Spam account',
  createdBy: 'did:mod',
})
// → Takes down subject, actions all spam reports on it, sets status='closed'

// 3. Escalate specific reports
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventEscalate' },
  subject: { $type: 'com.atproto.repo.strongRef#main', uri: 'at://did:456/app.bsky.feed.post/xyz' },
  reportAction: { ids: [201] },
  comment: 'Needs senior mod review',
  createdBy: 'did:mod',
})
// → Creates escalation event, sets status='escalated' on report 201

// 4. Action ALL reports on subject
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:789' },
  reportAction: { all: true, note: 'Account taken down for violations' },
  createdBy: 'did:mod',
})
// → Takes down subject, closes ALL reports on it

// 5. Dismiss reports without subject action
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventComment' },
  subject: { $type: 'com.atproto.repo.strongRef#main', uri: 'at://...' },
  reportAction: { ids: [201, 202], note: 'Thank you for reporting. No violation found.' },
  comment: 'False positive',
  createdBy: 'did:mod',
})
// → No subject action, but closes reports and notifies reporters
```

### `tools.ozone.queue.listQueues`

List all configured moderation queues with statistics.

See full lexicon definition: [lexicons/tools/ozone/queue/listQueues.json](lexicons/tools/ozone/queue/listQueues.json)

Shared type definitions: [lexicons/tools/ozone/queue/defs.json](lexicons/tools/ozone/queue/defs.json)

### `tools.ozone.queue.createQueue`

Create a new moderation queue. Will fail if the queue configuration conflicts with an existing queue.

See full lexicon definition: [lexicons/tools/ozone/queue/createQueue.json](lexicons/tools/ozone/queue/createQueue.json)

**Conflict detection logic:**
```typescript
// Before creating queue, check for conflicts
async function checkQueueConflict(input: CreateQueueInput) {
  const existingQueues = await db.db
    .selectFrom('report_queue')
    .selectAll()
    .execute()

  for (const existing of existingQueues) {
    // Check if there's overlap
    const subjectTypesOverlap = input.subjectTypes.some(st =>
      existing.subjectTypes.includes(st)
    )
    const collectionMatch = input.collection === existing.collection
    const reportTypesOverlap = input.reportTypes.some(rt =>
      existing.reportTypes.includes(rt)
    )

    if (subjectTypesOverlap && collectionMatch && reportTypesOverlap) {
      throw new InvalidRequestError(
        `Queue config conflicts with existing queue: ${existing.name}`,
        'ConflictingQueue',
        { conflictingQueue: existing }
      )
    }
  }
}
```

### `tools.ozone.queue.updateQueue`

Update queue properties. Currently only supports updating the name and enabled status to prevent configuration conflicts.

See full lexicon definition: [lexicons/tools/ozone/queue/updateQueue.json](lexicons/tools/ozone/queue/updateQueue.json)

### `tools.ozone.queue.deleteQueue`

Delete a moderation queue. Optionally migrate reports to another queue.

See full lexicon definition: [lexicons/tools/ozone/queue/deleteQueue.json](lexicons/tools/ozone/queue/deleteQueue.json)

**Implementation:**
```typescript
async function deleteQueue(input: DeleteQueueInput) {
  const queueToDelete = await db.db
    .selectFrom('report_queue')
    .where('name', '=', input.queueName)
    .selectAll()
    .executeTakeFirst()

  if (!queueToDelete) {
    throw new InvalidRequestError('Queue not found')
  }

  await db.transaction(async (dbTxn) => {
    if (input.migrateToQueue) {
      // Get target queue ID
      const targetQueue = await dbTxn.db
        .selectFrom('report_queue')
        .where('name', '=', input.migrateToQueue)
        .select('id')
        .executeTakeFirst()

      if (!targetQueue) {
        throw new InvalidRequestError('Target queue not found')
      }

      // Move all reports to new queue
      await dbTxn.db
        .updateTable('report')
        .set({
          queueId: targetQueue.id,
          queuedAt: new Date(),
        })
        .where('queueId', '=', queueToDelete.id)
        .execute()

      // Stats updated automatically via trigger
    } else {
      // Set reports to 'unassigned' (-1)
      await dbTxn.db
        .updateTable('report')
        .set({
          queueId: -1,
          queuedAt: new Date(),
        })
        .where('queueId', '=', queueToDelete.id)
        .execute()
    }

    // Delete queue config
    await dbTxn.db
      .deleteFrom('report_queue')
      .where('id', '=', queueToDelete.id)
      .execute()

    // Stats table row deleted automatically (CASCADE)
  })
}
```

### `tools.ozone.report.reassignQueue`

Manually reassign a report to a different queue (admin action).

See full lexicon definition: [lexicons/tools/ozone/report/reassignQueue.json](lexicons/tools/ozone/report/reassignQueue.json)

## Queue Stats Computation

### Background Job Approach

Queue statistics are computed periodically via a background job that runs every 5 minutes. This approach is simple, reliable, and avoids the complexity of triggers.

```typescript
// Background job to recompute all queue stats
async function recomputeQueueStats() {
  const queues = await db.db
    .selectFrom('report_queue')
    .select(['id', 'name'])
    .execute()

  for (const queue of queues) {
    const stats = await db.db
      .selectFrom('report as r')
      .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
      .where('r.queueId', '=', queue.id)
      .select([
        // Status counts
        sql`COUNT(*) FILTER (WHERE r.status = 'open')`.as('pendingCount'),
        sql`COUNT(*) FILTER (WHERE r.status = 'closed')`.as('actionedCount'),
        sql`COUNT(*) FILTER (WHERE r.status = 'escalated')`.as('escalatedPendingCount'),

        // Unique counts
        sql`COUNT(DISTINCT me.createdBy)`.as('uniqueReportersCount'),
        sql`COUNT(DISTINCT me.subjectDid)`.as('uniqueSubjectsDidCount'),
        sql`COUNT(DISTINCT CONCAT(me.subjectDid, '||', COALESCE(me.subjectUri, '')))`.as('uniqueSubjectsFullCount'),
      ])
      .executeTakeFirst()

    // Upsert stats
    await db.db
      .insertInto('report_queue_stats')
      .values({
        queueName: queue.name,
        pendingCount: Number(stats.pendingCount),
        actionedCount: Number(stats.actionedCount),
        escalatedPendingCount: Number(stats.escalatedPendingCount),
        uniqueReportersCount: Number(stats.uniqueReportersCount),
        uniqueSubjectsDidCount: Number(stats.uniqueSubjectsDidCount),
        uniqueSubjectsFullCount: Number(stats.uniqueSubjectsFullCount),
        lastUpdated: new Date(),
      })
      .onConflict((oc) =>
        oc.column('queueName').doUpdateSet({
          pendingCount: Number(stats.pendingCount),
          actionedCount: Number(stats.actionedCount),
          escalatedPendingCount: Number(stats.escalatedPendingCount),
          uniqueReportersCount: Number(stats.uniqueReportersCount),
          uniqueSubjectsDidCount: Number(stats.uniqueSubjectsDidCount),
          uniqueSubjectsFullCount: Number(stats.uniqueSubjectsFullCount),
          lastUpdated: new Date(),
        })
      )
      .execute()
  }
}

// Run every 5 minutes
setInterval(recomputeQueueStats, 5 * 60 * 1000)
```

**Benefits:**
- Simple implementation using standard Kysely queries
- No complex trigger logic to maintain
- Stats are eventually consistent (5min lag acceptable for dashboards)
- Easy to debug and monitor
- Can adjust frequency based on load

## Implementation Flow

### 1. Report Creation (on `modEventReport`)

When a report event is received via `emitEvent` - **always create a new report entry with NO queue assignment**:

```typescript
// In emitEvent handler, after logEvent
if (isModEventReport(event)) {
  const eventId = result.event.id

  await db.db.insertInto('report').values({
    eventId,
    queueId: null, // Will be assigned by background job
    actionEventIds: [],
    status: 'open',
  }).execute()
}
```

All report metadata (subject, reporter, type, timestamp, comment) lives in `moderation_event` table.

**Queue assignment happens later** via background job (see section 2).

### 2. Queue Assignment (Background Job)

**Background job runs periodically** (e.g., every 30 seconds) to assign queues to unassigned reports.

```typescript
// Background job (daemon or cron)
async function assignQueues() {
  // 1. Get all unassigned reports (queue_id IS NULL)
  const unassignedReports = await db.db
    .selectFrom('report as r')
    .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
    .where('r.queueId', 'is', null)
    .select([
      'r.id',
      'r.eventId',
      'me.subjectDid',
      'me.subjectUri',
      sql`me.meta->>'reportType'`.as('reportType'),
    ])
    .limit(1000) // Process in batches
    .execute()

  if (unassignedReports.length === 0) return

  // 2. Get all enabled queues
  const queues = await db.db
    .selectFrom('report_queue')
    .where('enabled', '=', true)
    .selectAll()
    .execute()

  // 3. Assign each report to matching queue
  for (const report of unassignedReports) {
    const queueId = findMatchingQueue(report, queues)

    await db.db
      .updateTable('report')
      .set({
        queueId: queueId || -1, // -1 = no matching queue
        queuedAt: new Date(),
      })
      .where('id', '=', report.id)
      .execute()

    // Stats updated automatically via trigger
  }
}

function findMatchingQueue(
  report: { subjectDid: string; subjectUri: string | null; reportType: string },
  queues: ReportQueue[]
): number | null {
  // Extract subject type and collection
  const subjectType = report.subjectUri ? 'record' : 'account'
  const collection = report.subjectUri
    ? report.subjectUri.split('/').find((part, idx, arr) =>
        idx === 4 && arr.length > 4 ? part : null
      )
    : null

  for (const queue of queues) {
    // Check subject type match
    if (!queue.subjectTypes.includes(subjectType)) continue

    // Check collection match (if record)
    if (subjectType === 'record') {
      if (queue.collection && queue.collection !== collection) continue
    }

    // Check report type match
    if (!queue.reportTypes.includes(report.reportType)) continue

    // Found matching queue!
    return queue.id
  }

  // No matching queue
  return null
}
```

**Benefits:**
- Small delay (< 1 min) in queue assignment, acceptable for moderation flow
- Queue reconfiguration does NOT trigger reassignment of existing reports
- Simple deterministic logic: one report → one queue
- Allows manual reassignment via admin action
- Stats updated automatically via database trigger

**Manual reassignment:**
```typescript
// Admin can manually move report to different queue
async function reassignReport(reportId: number, newQueueId: number) {
  await db.db
    .updateTable('report')
    .set({
      queueId: newQueueId,
      queuedAt: new Date(),
    })
    .where('id', '=', reportId)
    .execute()

  // Stats updated automatically via trigger
}
```

### 3. Report-Level Actions via `emitEvent`

**Modified `emitEvent` handler logic:**

```typescript
// In emitEvent handler, after creating moderation event
async function handleModerationEvent(input: HandlerInput) {
  // ... existing logic to create moderation event ...

  const moderationEvent = await db.transaction(async (dbTxn) => {
    const result = await moderationTxn.logEvent({
      event,
      subject,
      createdBy,
      modTool: input.body.modTool,
      externalId,
    })

    // NEW: Handle report-level actions
    if (input.body.reportAction) {
      await handleReportLevelAction({
        dbTxn,
        moderationEvent: result.event,
        reportAction: input.body.reportAction,
        subject,
        createdBy,
      })
    }

    // ... existing logic (tags, takedown, labels, etc.) ...

    return result.event
  })

  return moderationService.views.formatEvent(moderationEvent)
}

async function handleReportLevelAction(params: {
  dbTxn: Transaction
  moderationEvent: ModerationEventRow
  reportAction: { ids?: number[], types?: string[], all?: boolean, note?: string }
  subject: ModSubject
  createdBy: string
}) {
  const { dbTxn, moderationEvent, reportAction, subject } = params

  // Build query to find reports - JOIN with moderation_event for filtering
  let query = dbTxn.db
    .selectFrom('report as r')
    .innerJoin('moderation_event as me', 'me.id', 'r.eventId')
    .where('me.subjectDid', '=', subject.did)

  if (subject.uri) {
    query = query.where('me.subjectUri', '=', subject.uri)
  } else {
    query = query.where('me.subjectUri', 'is', null)
  }

  // Filter by specific report IDs
  if (reportAction.ids?.length) {
    query = query.where('r.id', 'in', reportAction.ids)
  }
  // OR filter by report types
  else if (reportAction.types?.length) {
    query = query.where(
      sql`me.meta->>'reportType'`,
      'in',
      reportAction.types
    )
  }
  // OR get ALL reports (if reportAction.all === true)
  // No additional filter needed, already filtered by subject

  const reports = await query
    .select(['r.*', 'me.createdBy as reportedBy'])
    .execute()

  // Determine new status based on event type
  const newStatus = getReportStatusFromEvent(moderationEvent.action)

  // Update each report
  for (const report of reports) {
    const currentActionIds = report.actionEventIds || []

    // Prepend new action ID (sorted DESC, newest first)
    await dbTxn.db
      .updateTable('report')
      .set({
        actionEventIds: [moderationEvent.id, ...currentActionIds],
        actionNote: reportAction.note,
        status: newStatus,
        updatedAt: new Date(),
      })
      .where('id', '=', report.id)
      .execute()

    // Send reporter notification
    if (reportAction.note) {
      await sendReporterNotification({
        reporterDid: report.reportedBy,
        note: reportAction.note,
        subject,
        action: moderationEvent.action,
      })
    }

    // Clear Redis "in review" lock
    await redis.del(`report:in_review:${report.id}`)
  }
}

function getReportStatusFromEvent(eventAction: string): 'open' | 'closed' | 'escalated' {
  if (eventAction === 'tools.ozone.moderation.defs#modEventEscalate') {
    return 'escalated'
  }
  // Acknowledge, Takedown, Label, Comment (dismiss) all close the report
  if ([
    'tools.ozone.moderation.defs#modEventAcknowledge',
    'tools.ozone.moderation.defs#modEventTakedown',
    'tools.ozone.moderation.defs#modEventLabel',
    'tools.ozone.moderation.defs#modEventComment',
  ].includes(eventAction)) {
    return 'closed'
  }
  return 'open' // Shouldn't happen, but default to open
}
```

**Usage examples:**

```typescript
// 1. Acknowledge specific reports (no subject state change)
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventAcknowledge' },
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:123' },
  reportAction: { ids: [101, 102], note: 'Reviewed, no violation found' },
  createdBy: 'did:mod',
})

// 2. Takedown subject AND action all spam reports on it
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:123' },
  reportAction: {
    types: ['tools.ozone.report.defs#reasonSpam'],
    note: 'Action taken'
  },
  createdBy: 'did:mod',
})

// 3. Dismiss reports without subject action
emitEvent({
  event: {
    $type: 'tools.ozone.moderation.defs#modEventComment',
    comment: 'False positive',
  },
  subject: { $type: 'com.atproto.repo.strongRef#main', uri: 'at://...' },
  reportAction: { ids: [201, 202], note: 'Thank you for reporting. No violation found.' },
  createdBy: 'did:mod',
})

// 4. Escalate specific report
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventEscalate' },
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:456' },
  reportAction: { ids: [301] },
  comment: 'Needs senior review',
  createdBy: 'did:mod',
})

// 5. Action ALL reports on a subject
emitEvent({
  event: { $type: 'tools.ozone.moderation.defs#modEventTakedown' },
  subject: { $type: 'com.atproto.admin.defs#repoRef', did: 'did:789' },
  reportAction: { all: true, note: 'Account taken down for violations' },
  createdBy: 'did:mod',
})
```

## Moderator Analytics

All analytics queries JOIN `report` with `moderation_event` to access metadata.

### Query Examples

**Moderator activity by report type:**
```sql
SELECT
  action_me.createdBy as reviewed_by,
  report_me.meta->>'reportType' as report_type,
  action_me.action as action_type,
  COUNT(*) as action_count,
  DATE_TRUNC('day', action_me.createdAt) as action_date
FROM report r
JOIN moderation_event report_me ON report_me.id = r.eventId
JOIN moderation_event action_me ON action_me.id = r.actionEventIds[1] -- Latest action
WHERE array_length(r.actionEventIds, 1) > 0
  AND action_me.createdAt >= NOW() - INTERVAL '7 days'
GROUP BY action_me.createdBy, report_me.meta->>'reportType', action_me.action, action_date
ORDER BY action_date DESC, reviewed_by;
```

**Reports actioned per moderator per week:**
```sql
SELECT
  action_me.createdBy as reviewed_by,
  DATE_TRUNC('week', action_me.createdAt) as week,
  COUNT(*) as reports_actioned,
  COUNT(DISTINCT report_me.subjectDid) as unique_subjects,
  COUNT(*) FILTER (WHERE r.status = 'closed') as closed_count,
  COUNT(*) FILTER (WHERE r.status = 'escalated') as escalated_count
FROM report r
JOIN moderation_event report_me ON report_me.id = r.eventId
JOIN moderation_event action_me ON action_me.id = r.actionEventIds[1]
WHERE array_length(r.actionEventIds, 1) > 0
  AND action_me.createdAt >= NOW() - INTERVAL '4 weeks'
GROUP BY action_me.createdBy, week
ORDER BY week DESC, reports_actioned DESC;
```

**Report type → action mapping:**
```sql
SELECT
  report_me.meta->>'reportType' as report_type,
  action_me.action as action_type,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY report_me.meta->>'reportType') as percentage
FROM report r
JOIN moderation_event report_me ON report_me.id = r.eventId
JOIN moderation_event action_me ON action_me.id = r.actionEventIds[1]
WHERE array_length(r.actionEventIds, 1) > 0
  AND action_me.createdAt >= NOW() - INTERVAL '30 days'
GROUP BY report_me.meta->>'reportType', action_me.action
ORDER BY report_type, count DESC;
```

**Queue throughput:**
```sql
-- For a specific queue by ID
SELECT
  COUNT(*) FILTER (WHERE r.status = 'open') as open,
  COUNT(*) FILTER (WHERE r.status = 'escalated') as escalated,
  COUNT(*) FILTER (WHERE r.status = 'closed') as closed,
  AVG(EXTRACT(EPOCH FROM (action_me.createdAt - report_me.createdAt)))
    FILTER (WHERE action_me.id IS NOT NULL) as avg_resolution_time_seconds
FROM report r
JOIN moderation_event report_me ON report_me.id = r.eventId
LEFT JOIN moderation_event action_me ON action_me.id = r.actionEventIds[1]
WHERE r.queueId = 123 -- Replace with actual queue ID
  AND report_me.createdAt >= NOW() - INTERVAL '7 days';
```

**Time to action by report type:**
```sql
SELECT
  report_me.meta->>'reportType' as report_type,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (action_me.createdAt - report_me.createdAt))) as median_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (action_me.createdAt - report_me.createdAt))) as p95_seconds,
  COUNT(*) as sample_size
FROM report r
JOIN moderation_event report_me ON report_me.id = r.eventId
JOIN moderation_event action_me ON action_me.id = r.actionEventIds[1]
WHERE array_length(r.actionEventIds, 1) > 0
  AND action_me.createdAt >= NOW() - INTERVAL '30 days'
GROUP BY report_me.meta->>'reportType'
ORDER BY median_seconds DESC;
```

**Report status distribution by queue:**
```sql
SELECT
  q.name as queue_name,
  r.status,
  COUNT(*) as count
FROM report r
JOIN report_queue q ON q.id = r.queueId
WHERE r.queueId IS NOT NULL AND r.queueId != -1
  AND r.createdAt >= NOW() - INTERVAL '7 days'
GROUP BY q.name, r.status
ORDER BY queue_name, r.status;
```

**Performance note:** Consider adding these indexes to `moderation_event` for faster analytics:
```sql
CREATE INDEX idx_moderation_event_created_by ON moderation_event(createdBy, createdAt);
CREATE INDEX idx_moderation_event_report_type ON moderation_event((meta->>'reportType'))
  WHERE action = 'tools.ozone.moderation.defs#modEventReport';
```

## Migration Strategy

1. **Phase 1: Schema changes**
   - Add `report` and `report_queue` tables
   - Add indexes to `moderation_event` for analytics (`createdBy`, `meta->>'reportType'`)
   - Add Redis for in-review tracking

2. **Phase 2: Backfill**
   - Populate `report` table from existing `moderation_event` where `action = 'modEventReport'`
   - Match reports to actions by subject/timestamp heuristics (best effort)

3. **Phase 3: Dual-write**
   - Start creating `report` rows on new report events
   - Maintain existing subject-based flow (no breaking changes)

4. **Phase 4: New endpoints**
   - Deploy `queryReports` endpoint
   - Extend `emitEvent` with `reportIds`, `reportTypes`, `reporterNote` params
   - Deploy `getReportsBySubject`, `listQueues`, `upsertQueue`

5. **Phase 5: WebSocket server**
   - Deploy WebSocket server for real-time updates
   - Implement Redis pub/sub for multi-instance scaling

6. **Phase 6: Client migration**
   - Update moderation UI to use report-based workflow
   - Add queue management UI
   - Implement WebSocket client for real-time updates

7. **Phase 7: Analytics**
   - Build dashboards on new report data
   - Moderator performance metrics
   - Queue throughput monitoring

## Backward Compatibility

- Existing `queryStatuses` and `emitEvent` endpoints remain unchanged
- Report-based workflow is additive, doesn't break subject-based workflow
- `moderation_subject_status` table continues to track aggregated subject state
- Both workflows can coexist during migration period

---

## Example Queue Configurations

With the new schema, each report matches **exactly one queue**. Queue configs must not overlap.

### Harassment Queues (Split by Content Type)

```typescript
// Harassment - accounts only
{
  name: 'Harassment: Accounts',
  subjectTypes: ['account'],
  collection: null,
  reportTypes: [
    'com.atproto.moderation.defs#reasonHarassmentTroll',
    'com.atproto.moderation.defs#reasonHarassmentTargeted',
    'com.atproto.moderation.defs#reasonHarassmentHateSpeech',
  ],
  createdBy: 'did:plc:admin123',
}

// Harassment - posts only
{
  name: 'Harassment: Posts',
  subjectTypes: ['record'],
  collection: 'app.bsky.feed.post',
  reportTypes: [
    'com.atproto.moderation.defs#reasonHarassmentTroll',
    'com.atproto.moderation.defs#reasonHarassmentTargeted',
    'com.atproto.moderation.defs#reasonHarassmentHateSpeech',
  ],
  createdBy: 'did:plc:admin123',
}
```

### CSAM Queue

```typescript
// CSAM - all subject types
{
  name: 'CSAM',
  subjectTypes: ['account', 'record'],
  collection: null, // Matches both accounts and any record type
  reportTypes: ['com.atproto.moderation.defs#reasonSexual'],
  createdBy: 'did:plc:admin123',
}
```

### Invalid Configurations (Would Conflict)

```typescript
// ❌ CONFLICT: This would overlap with "Harassment: Accounts" above
{
  name: 'General Harassment',
  subjectTypes: ['account', 'record'], // Includes account!
  collection: null,
  reportTypes: ['com.atproto.moderation.defs#reasonHarassmentTroll'], // Overlaps!
  createdBy: 'did:plc:admin123',
}
// Error: ConflictingQueue - overlaps with "Harassment: Accounts"

// ❌ CONFLICT: subset of report types
{
  name: 'Just Trolling',
  subjectTypes: ['account'],
  collection: null,
  reportTypes: ['com.atproto.moderation.defs#reasonHarassmentTroll'], // Subset!
  createdBy: 'did:plc:admin123',
}
// Error: ConflictingQueue - overlaps with "Harassment: Accounts"
```

## Real-Time WebSocket Architecture

### Overview

Enable real-time collaboration between moderators with WebSocket-based updates for:
1. **In-review status** - Show which mods are reviewing which reports
2. **Action notifications** - Update all clients when reports are actioned
3. **Queue updates** - Notify when new reports arrive in queues

### Architecture Components

#### 1. WebSocket Server Setup

```typescript
// Using ws library or similar
import { WebSocketServer } from 'ws'

interface ModeratorClient {
  ws: WebSocket
  moderatorDid: string
  moderatorHandle: string
  subscribedQueues: string[] // Queues they're viewing
}

const clients = new Map<string, ModeratorClient>() // clientId -> client

wss.on('connection', (ws, req) => {
  const auth = await authenticateWebSocket(req)
  const clientId = generateClientId()

  clients.set(clientId, {
    ws,
    moderatorDid: auth.credentials.iss,
    moderatorHandle: auth.credentials.handle,
    subscribedQueues: [],
  })

  ws.on('message', (data) => handleMessage(clientId, data))
  ws.on('close', () => handleDisconnect(clientId))
})
```

#### 2. Message Types

```typescript
// Client → Server
type ClientMessage =
  | {
      type: 'subscribe'
      queues: string[] // Subscribe to queue updates
    }
  | {
      type: 'unsubscribe'
      queues: string[]
    }
  | {
      type: 'report:review:start'
      reportId: number
    }
  | {
      type: 'report:review:end'
      reportId: number
    }
  | {
      type: 'ping' // Heartbeat
    }

// Server → Client
type ServerMessage =
  | {
      type: 'report:review:started'
      reportId: number
      moderator: { did: string; handle: string }
    }
  | {
      type: 'report:review:ended'
      reportId: number
      moderator: { did: string; handle: string }
    }
  | {
      type: 'report:actioned'
      reportIds: number[]
      actionEventId: number
      moderator: { did: string; handle: string }
      queues: string[] // Which queues this affects
    }
  | {
      type: 'report:created'
      reportId: number
      queues: string[] // Which queues this should appear in
      report: ReportView
    }
  | {
      type: 'pong'
    }
```

#### 3. In-Review Tracking

**Client starts reviewing:**
```typescript
// Client sends WebSocket message
ws.send(JSON.stringify({
  type: 'report:review:start',
  reportId: 123,
}))

// Server handler
async function handleReviewStart(clientId: string, reportId: number) {
  const client = clients.get(clientId)

  // Store in Redis with TTL
  await redis.setex(
    `report:in_review:${reportId}`,
    300, // 5 min TTL
    JSON.stringify({
      moderatorDid: client.moderatorDid,
      moderatorHandle: client.moderatorHandle,
      startedAt: new Date().toISOString(),
      clientId, // For cleanup
    })
  )

  // Broadcast to other moderators
  broadcastToOthers(clientId, {
    type: 'report:review:started',
    reportId,
    moderator: {
      did: client.moderatorDid,
      handle: client.moderatorHandle,
    },
  })

  // Set up heartbeat
  scheduleHeartbeat(clientId, reportId)
}
```

**Client stops reviewing (explicit or disconnect):**
```typescript
async function handleReviewEnd(clientId: string, reportId: number) {
  const reviewData = await redis.get(`report:in_review:${reportId}`)
  if (!reviewData) return

  const review = JSON.parse(reviewData)
  if (review.clientId !== clientId) return // Not this client's lock

  await redis.del(`report:in_review:${reportId}`)

  broadcastToAll({
    type: 'report:review:ended',
    reportId,
    moderator: {
      did: review.moderatorDid,
      handle: review.moderatorHandle,
    },
  })
}

async function handleDisconnect(clientId: string) {
  const client = clients.get(clientId)

  // Clean up all in-review locks for this client
  const keys = await redis.keys('report:in_review:*')
  for (const key of keys) {
    const data = await redis.get(key)
    const review = JSON.parse(data)
    if (review.clientId === clientId) {
      const reportId = key.split(':')[2]
      await handleReviewEnd(clientId, parseInt(reportId))
    }
  }

  clients.delete(clientId)
}
```

#### 4. Action Notifications

**When report is actioned via `emitEvent`:**
```typescript
// In handleReportLevelAction, after updating reports
async function notifyReportActioned(params: {
  reportIds: number[]
  actionEventId: number
  moderatorDid: string
  moderatorHandle: string
}) {
  // Get affected queue names
  const reports = await db.db
    .selectFrom('report as r')
    .leftJoin('report_queue as q', 'q.id', 'r.queueId')
    .where('r.id', 'in', params.reportIds)
    .select(['q.name as queueName'])
    .execute()

  const affectedQueues = [...new Set(
    reports.map(r => r.queueName).filter(Boolean)
  )]

  // Broadcast to all connected moderators
  broadcastToAll({
    type: 'report:actioned',
    reportIds: params.reportIds,
    actionEventId: params.actionEventId,
    moderator: {
      did: params.moderatorDid,
      handle: params.moderatorHandle,
    },
    queues: affectedQueues,
  })

  // Clean up in-review locks
  for (const reportId of params.reportIds) {
    await redis.del(`report:in_review:${reportId}`)
  }
}
```

#### 5. Queue Subscriptions & New Report Notifications

**Client subscribes to queue:**
```typescript
// Client
ws.send(JSON.stringify({
  type: 'subscribe',
  queues: ['harassment-text', 'spam'],
}))

// Server
function handleSubscribe(clientId: string, queues: string[]) {
  const client = clients.get(clientId)
  client.subscribedQueues = [...new Set([...client.subscribedQueues, ...queues])]
}
```

**New report arrives:**
```typescript
// In report creation handler, after inserting report
async function notifyNewReport(report: ReportRow, reportEvent: ModerationEventRow) {
  // Determine which queues this report matches
  const matchingQueues = await determineQueuesForReport(report, reportEvent)

  // Get formatted report view
  const reportView = await formatReportView(report)

  // Broadcast only to clients subscribed to affected queues
  for (const [clientId, client] of clients) {
    const hasMatchingQueue = client.subscribedQueues.some(q =>
      matchingQueues.includes(q)
    )

    if (hasMatchingQueue) {
      client.ws.send(JSON.stringify({
        type: 'report:created',
        reportId: report.id,
        queues: matchingQueues,
        report: reportView,
      }))
    }
  }
}

async function determineQueuesForReport(
  report: ReportRow,
  reportEvent: ModerationEventRow
): Promise<string[]> {
  const queues = await db.db
    .selectFrom('report_queue')
    .where('enabled', '=', true)
    .selectAll()
    .execute()

  const matching = []

  for (const queue of queues) {
    const reportType = reportEvent.meta?.reportType as string

    // Check report type match
    if (!queue.reportTypes.includes(reportType)) continue

    // Check subject type
    if (queue.subjectType === 'account' && reportEvent.subjectUri) continue
    if (queue.subjectType === 'record' && !reportEvent.subjectUri) continue

    // Check collections
    if (queue.collections?.length && reportEvent.subjectUri) {
      const matchesCollection = queue.collections.some(col =>
        reportEvent.subjectUri?.includes(`/${col}/`)
      )
      if (!matchesCollection) continue
    }

    // Check escalation
    if (queue.escalationOnly && !report.escalated) continue

    matching.push(queue.name)
  }

  return matching
}
```

#### 6. Client Implementation Example

```typescript
// React/TypeScript example
class ModerationWebSocket {
  private ws: WebSocket
  private reportListeners = new Map<number, Set<(event: any) => void>>()
  private queueListeners = new Map<string, Set<(event: any) => void>>()

  connect(token: string) {
    this.ws = new WebSocket(`wss://ozone.example.com/ws?token=${token}`)

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      this.handleMessage(msg)
    }

    // Heartbeat
    setInterval(() => {
      this.ws.send(JSON.stringify({ type: 'ping' }))
    }, 30000)
  }

  startReviewing(reportId: number) {
    this.ws.send(JSON.stringify({
      type: 'report:review:start',
      reportId,
    }))
  }

  stopReviewing(reportId: number) {
    this.ws.send(JSON.stringify({
      type: 'report:review:end',
      reportId,
    }))
  }

  subscribeToQueue(queueName: string, callback: (event: any) => void) {
    if (!this.queueListeners.has(queueName)) {
      this.queueListeners.set(queueName, new Set())

      // Send subscribe message
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        queues: [queueName],
      }))
    }

    this.queueListeners.get(queueName).add(callback)
  }

  private handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case 'report:review:started':
        // Show "Being reviewed by X" indicator in UI
        this.notifyReportListeners(msg.reportId, msg)
        break

      case 'report:review:ended':
        // Clear "Being reviewed" indicator
        this.notifyReportListeners(msg.reportId, msg)
        break

      case 'report:actioned':
        // Remove reports from queue UI
        for (const reportId of msg.reportIds) {
          this.notifyReportListeners(reportId, msg)
        }
        for (const queue of msg.queues) {
          this.notifyQueueListeners(queue, msg)
        }
        break

      case 'report:created':
        // Add report to queue UI if visible
        for (const queue of msg.queues) {
          this.notifyQueueListeners(queue, msg)
        }
        break
    }
  }

  private notifyReportListeners(reportId: number, event: any) {
    const listeners = this.reportListeners.get(reportId)
    if (listeners) {
      listeners.forEach(cb => cb(event))
    }
  }

  private notifyQueueListeners(queueName: string, event: any) {
    const listeners = this.queueListeners.get(queueName)
    if (listeners) {
      listeners.forEach(cb => cb(event))
    }
  }
}

// Usage in React component
function QueueView({ queueName }: { queueName: string }) {
  const ws = useModWebSocket()
  const [reports, setReports] = useState<ReportView[]>([])

  useEffect(() => {
    ws.subscribeToQueue(queueName, (event) => {
      if (event.type === 'report:created') {
        setReports(prev => [event.report, ...prev])
      } else if (event.type === 'report:actioned') {
        setReports(prev => prev.filter(r => !event.reportIds.includes(r.id)))
      }
    })
  }, [queueName])

  return (
    <div>
      {reports.map(report => (
        <ReportCard
          key={report.id}
          report={report}
          inReview={report.inReview} // From WebSocket event
        />
      ))}
    </div>
  )
}
```

### Scaling Considerations

1. **Redis Pub/Sub** - For multiple Ozone server instances:
```typescript
// Server 1 broadcasts action
await redis.publish('ozone:reports', JSON.stringify({
  type: 'report:actioned',
  reportIds: [123, 124],
  // ...
}))

// All servers subscribe
redis.subscribe('ozone:reports', (message) => {
  const event = JSON.parse(message)
  broadcastToLocalClients(event)
})
```

2. **Connection pooling** - Limit connections per moderator session
3. **Backpressure** - Queue messages if client slow to process
4. **Reconnection logic** - Client re-subscribes to queues on reconnect
