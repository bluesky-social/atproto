---
"@atproto/pds": patch
"@atproto/api": patch
---

Enforce takedowns on permissioned spaces the way the public repo does. A taken-down or deactivated space authority no longer issues space credentials or lists its spaces' repos (`RepoTakendown` / `RepoDeactivated`). Space management methods check takedown and deactivation. `com.atproto.admin.updateSubjectStatus` rejects space records, and `getSubjectStatus` reports them as not taken down. The admin token can read space repos, and a taken-down account can still export its spaces through `space.getRepo`, `listBlobs`, `getBlob`, `listSpaces`, and `exportSpaceMeta`.
