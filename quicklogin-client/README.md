# QuickLogin Test Client

A minimal HTML/JavaScript client to test the QuickLogin flow.

## How to Run

1. Make sure PDS is running on port 2583:

   ```bash
   cd /Users/jarlix/git/atproto/services/pds
   ./start-quicklogin.sh
   ```

2. Start the client on port 8080:

   ```bash
   cd /Users/jarlix/git/atproto/quicklogin-client
   python3 -m http.server 8080
   ```

3. Open browser:

   ```
   http://localhost:8080
   ```

4. Click "Start QuickLogin" and scan the QR code with W ID app

## What it does

1. Calls `/xrpc/io.trustanchor.quicklogin.init` to start a session
2. Displays a QR code linking to the provider
3. Polls `/xrpc/io.trustanchor.quicklogin.status` every 2 seconds
4. Shows the login result (DID, handle, tokens) when completed

## No ngrok needed

This client runs entirely locally:

- Client: http://localhost:8080
- PDS: http://localhost:2583

The provider callback goes directly to your PDS at the configured public URL.
