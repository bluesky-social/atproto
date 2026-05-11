/**
 * Using a to low threshold (e.g. 10) can cause performance degradation due to
 * switching to iterative implementation too early, while using a too high
 * threshold (e.g. 10_000) can cause call stack overflow errors with deeply
 * nested structures. Empirical tests have shown that a threshold of around
 * 1,000 provides a good balance.
 *
 * @internal
 */
export const MAX_RECURSION_DEPTH_DEFAULT = 1000
