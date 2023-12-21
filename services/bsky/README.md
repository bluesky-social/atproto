# bsky appview service

This is the service entrypoint for the bsky appview. The entrypoint command should run `api.js` with node, e.g. `node api.js`. The following env vars are supported:

- `BSKY_PUBLIC_URL` - (required) the public url of the appview, e.g. `https://api.bsky.app`.
- `BSKY_DID_PLC_URL` - (required) the url of the PLC service used for looking up did documents, e.g. `https://plc.directory`.
- `BSKY_DATAPLANE_URL` - (required) the url where the backing dataplane service lives.
- `BSKY_SERVICE_SIGNING_KEY` - (required) the public signing key in the form of a `did:key`, used for service-to-service auth. Advertised in the appview's `did:web`` document.
- `BSKY_ADMIN_PASSWORD` - (required) the admin password used for role-based auth.
- `NODE_ENV` - (recommended) for production usage, should be set to `production`. Otherwise all responses are validated on their way out. There may be other effects of not setting this to `production`, as dependencies may also implement debug modes based on its value.
- `BSKY_VERSION` - (recommended) version of the bsky service. This is advertised by the health endpoint.
- `BSKY_PORT` - (recommended) the port that the service will run on.
- `BSKY_IMG_URI_ENDPOINT` - (recommended) the base url for resized images, e.g. `https://https://cdn.bsky.app/img`. When not set, sets-up an image resizing service directly on the appview.
- `BSKY_SERVER_DID` - (recommended) the did of the appview service. When this is a `did:web` that matches the appview's public url, a `did:web` document is served.
- `BSKY_FEED_PUBLISHER_DID` - indicates the publisher did of any feedgen records which the appview supports.
- `BSKY_FEED_GEN_DID` - the did of the appview's feed generator service. When present the appview implements `app.bsky.feed.describeFeedGenerator`.
- `BSKY_HANDLE_RESOLVE_NAMESERVERS` - alternative domain name servers used for handle resolution, comma-separated.
- `BSKY_BLOB_CACHE_LOC` - when `BSKY_IMG_URI_ENDPOINT` is not set, this determines where resized blobs are cached by the image resizing service.
- `BSKY_MODERATOR_PASSWORD` - the moderator password used for role-based auth.
- `BSKY_TRIAGE_PASSWORD` - the triage password used for role-based auth.
