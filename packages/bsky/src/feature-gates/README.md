# Feature Gates

A thin wrapper around [GrowthBook](https://www.growthbook.io/) for feature flag
evaluation and experiment tracking.

## Usage

Call `checkGates` at the **top of each request handler** to evaluate feature
gates for the current user. This ensures consistent targeting throughout the
request lifecycle.

> [!NOTE]
> Only pass in the gates you wish to check for this endpoint. Passing in more
> will result in extraneous calls to our exposures endpoint, which could skew
> experiment results in unexpected ways.

```ts
const hydrateCtx = await ctx.hydrator.createContext({
  // ...
  featureGatesMap: ctx.featureGatesClient.checkGates(
    ['threads:reply_ranking_exploration:enable'],
    { viewer, req },
  ),
})
```

The returned `CheckedFeatureGatesMap` can then be passed through context and
accessed wherever needed.

## User Identification

If the user is authenticated, we use their DID as the identifier for feature
targeting via the `viewer` param of the `checkGates` call.

For unauthenticated users, and for experiments that don't require DID-level
targeting, we rely on identifiers passed from the client as headers:

- `X-Bsky-Stable-Id` - persistent device/client identifier
- `X-Bsky-Session-Id` - current session identifier

> [!WARNING]
> If both `stableId` and `did` are missing, all gates return `false`. This
> prevents untargeted users from being enrolled in experiments.

## Adding New Gates

Add new gate IDs to the `FeatureGate` type in `gates.ts`.
