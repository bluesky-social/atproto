// @NOTE "/account" already has a dedicated route (in
// ../(authenticated)/route.tsx) so we can't have a "parent" route defined here
// for all the unauthenticated routes. Instead, unauthenticated routes will just
// reference the RootRoute directly, and use full paths
// ("/account/reset-password") instead. We could create a hierarchical route
// structure for unauthenticated routes if we wanted to, but it would require to
// make at least some paths more complex (e.g.
// "/account/unauthenticated/reset-password"), without much value.

// Note that we may eventually want to allow "/" to be a user-facing page (e.g.
// a landing page for the PDS), at which point the comment above would become
// irrelevant as unauthenticated routes would be natural children of the
// RootRoute.
