# PLA-33 Plan

## Problem

When a user marks notifications as read, AppView updates only Atlantis in its own PoP. Atlantis in the other PoP keeps the old timestamp, so switching PoPs can make old notifications appear unread.

## New Flow

1. AppView sends the user's DID and read timestamp to bsync.
2. bsync calls every configured dataplane address at the same time.
3. Each Atlantis writes the timestamp to its own Scylla database.
4. If one call fails, bsync still completes the other calls. The next request tries every configured address again.

## Changes

### Atlantis

Change the Scylla write so an older timestamp cannot replace a newer timestamp. Use the notification timestamp as Scylla's write timestamp.

### Notification priority

- Remove `priority` from the notification seen and unread count protobuf messages and reserve its field number.
- Stop sending, reading, or writing separate notification read timestamps based on `priority`.
- Make the TypeScript dataplane use the same timestamp for normal and priority notifications.
- Leave the unrelated notification priority preference unchanged.

### bsync

- Add an endpoint that accepts a DID and notification read timestamp.
- Configure a list of authenticated dataplane addresses.
- Call every configured address at the same time and wait for every call to finish.
- A failed call does not stop the other calls.
- Generate only the Atlantis protobuf method and messages needed for these calls.

### AppView

- First deployment: keep the direct dataplane call and add the bsync call.
- Add a TODO to remove the direct dataplane call after the bsync path is verified in production.
- Second deployment: remove the direct dataplane call and keep only the bsync call.
- Stop passing `priority` when reading notification timestamps and unread counts.
- Keep the Courier call unchanged.

### Infrastructure

- Give bsync the credentials required by the configured dataplane addresses.
- Configure one dataplane address per PoP, through Atlantis proxy.

## Rollout

1. Deploy the Atlantis change that prevents the timestamp from decreasing.
2. Deploy the bsync endpoint and configure the dataplane addresses.
3. Deploy AppView with both the existing direct dataplane call and the new bsync call.
4. Confirm that every configured dataplane receives updates and that an older request cannot decrease the stored timestamp.
5. Remove the direct dataplane call from AppView, leaving only the bsync call.
