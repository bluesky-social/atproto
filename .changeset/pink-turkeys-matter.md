---
'@atproto/api': minor
---

- Breaking changes
  - Redesigned the `moderate*` APIs which now output a `ModerationUI` object.
  - `agent.getPreferences()` output object `BskyPreferences` has been modified.
  - Moved Ozone routes from `com.atproto.admin` to `tools.ozone` namespace.
- Additions
  - Added support for labeler configuration in `Agent.configure()` and `agent.configureLabelerHeader()`.
  - Added `agent.addLabeler()` and `agent.removeLabeler()` preference methods.
  - Muted words and hidden posts are now handled in the `moderate*` APIs.
  - Added `agent.getLabelers()` and `agent.getLabelDefinitions()`.
  - Added `agent.configureProxyHeader()` and `withProxy()` methods to support remote service proxying behaviors.
