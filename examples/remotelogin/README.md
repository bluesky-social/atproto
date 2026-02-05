# RemoteLogin Testing Examples

This directory contains examples for testing the Neuro RemoteLogin authentication flow.

## What is RemoteLogin?

RemoteLogin allows users to authenticate using their Neuro Legal ID instead of a password. When a user signs in, a petition is sent to their Neuro app for approval, providing strong authentication through the user's mobile device.

## Prerequisites

1. **Neuro Account**: You need a Neuro account with:

   - A Legal ID (format: `{GUID}@legal.{domain}`)
   - RemoteLogin privileges granted by your domain administrator
   - The Neuro mobile app installed

2. **PDS Configuration**: Your PDS must be configured with:

   - `PDS_NEURO_ENABLED=true`
   - `PDS_NEURO_API_TYPE=remotelogin` (or `both`)
   - `PDS_NEURO_DOMAIN` set to your Neuron server
   - `PDS_NEURO_CALLBACK_BASE_URL` (publicly accessible URL for callbacks)
   - Authentication credentials (Basic auth, Bearer token, or mTLS)

3. **Account Link**: The user's ATProto account must be linked to their Legal ID in the `neuro_identity_link` table.

## Testing Methods

### 1. Browser-Based Testing

Open `oauth-flow-example.html` in your browser and follow the on-screen instructions. This demonstrates:

- Initiating a RemoteLogin petition
- Waiting for user approval in the Neuro app
- Receiving session tokens upon successful authentication

**Configuration**: Edit the HTML file to set your PDS URL and test credentials.

### 2. Command-Line Testing

Use the example shell script:

```bash
# Set environment variables
export PDS_URL="https://your-pds.example.com"
export NEURO_LEGAL_ID="your-guid@legal.example.com"
export TEST_HANDLE="testuser.example.com"

# Run the test
./test-remotelogin-example.sh
```

The script will:

1. Call the `createSession` endpoint with your Legal ID
2. Wait for you to approve the petition in your Neuro app
3. Display the authentication result

## Authentication Flow

```
┌─────────┐                 ┌─────────┐                 ┌─────────┐
│ Client  │                 │   PDS   │                 │  Neuron │
└────┬────┘                 └────┬────┘                 └────┬────┘
     │                           │                           │
     │ createSession             │                           │
     │ (with Legal ID)           │                           │
     ├──────────────────────────>│                           │
     │                           │                           │
     │                           │ Create Petition           │
     │                           ├──────────────────────────>│
     │                           │                           │
     │                           │ PetitionId                │
     │                           │<──────────────────────────┤
     │                           │                           │
     │   Waiting for approval... │                           │
     │                           │                           │
     │                           │    ┌──────────────┐       │
     │                           │    │  Neuro App   │       │
     │                           │    │              │       │
     │                           │    │ User approves│       │
     │                           │    │  petition    │       │
     │                           │    └──────────────┘       │
     │                           │                           │
     │                           │ Callback (JWT Token)      │
     │                           │<──────────────────────────┤
     │                           │                           │
     │  Session Tokens           │                           │
     │  (accessJwt, refreshJwt)  │                           │
     │<──────────────────────────┤                           │
     │                           │                           │
```

## Troubleshooting

### "No account linked to this Legal ID"

- Verify the account is linked in the `neuro_identity_link` table
- Check that the Legal ID format is correct
- Ensure the database is accessible

### Petition timeout

- Default timeout is 5 minutes (configurable via `PDS_NEURO_PETITION_TIMEOUT`)
- Make sure the Neuro app is running and connected
- Check that push notifications are enabled

### Callback not received

- Verify `PDS_NEURO_CALLBACK_BASE_URL` is publicly accessible
- Check firewall/network settings
- Ensure the callback route `/neuro/remotelogin/callback` is working
- Test with a tool like ngrok for local development

### Authentication credentials invalid

- Verify `PDS_NEURO_AUTH_METHOD` matches your Neuron configuration
- Check username/password for Basic auth
- Verify token hasn't expired for Bearer auth
- Ensure certificate is valid for mTLS

## Security Considerations

- **Never commit credentials**: Use environment variables or secure configuration management
- **JWT Verification**: Enable `PDS_NEURO_VERIFY_JWT=true` in production
- **HTTPS Required**: Callback URLs must use HTTPS in production
- **Rate Limiting**: Consider implementing rate limits on petition creation
- **Audit Logging**: Log all RemoteLogin attempts for security monitoring

## Additional Resources

- [Neuro Implementation Guide](../../neuro_implementation_guide.md)
- [NeuroRemoteLoginManager Source](../../packages/pds/src/account-manager/helpers/neuro-remotelogin-manager.ts)
- [NeuronAuthClient Source](../../packages/pds/src/account-manager/helpers/neuron-auth-client.ts)
