# ForgeApps Remote Push + CRM Spec

This repo now supports APNs device token capture and backend registration from iOS.  
The ForgeApps website/CRM can use the API contract below to authenticate developers and send targeted pushes.

## 1) Developer Login (Website CRM)

- Route: `POST /api/developer/login`
- Request:

```json
{
  "email": "dev@forgeapps.co.uk",
  "password": "••••••••"
}
```

- Response:

```json
{
  "token": "jwt-or-api-token",
  "expiresAt": "2026-06-01T12:00:00Z",
  "developer": {
    "id": "dev_123",
    "email": "dev@forgeapps.co.uk",
    "name": "ForgeApps Admin"
  }
}
```

Store this token in CRM session and send it as `Authorization: Bearer <token>`.

## 2) Device Registration (called by iOS app)

- Route: `POST /api/push/devices/register`
- Headers:
  - `Authorization: Bearer <developer token>`
  - `Content-Type: application/json`
  - `X-Developer-Email: <optional email>`
- Request:

```json
{
  "installationID": "uuid-per-install",
  "userID": "optional-user-id",
  "deviceToken": "apns-token-hex",
  "platform": "ios",
  "bundleID": "com.louis.PayForge",
  "appVersion": "1.0.0",
  "buildNumber": "1",
  "timezoneIdentifier": "Europe/London",
  "localeIdentifier": "en_GB"
}
```

- Response:

```json
{
  "ok": true,
  "deviceId": "device_123",
  "updatedAt": "2026-06-01T12:00:00Z"
}
```

## 3) Send Developer Push (called by CRM or iOS dev tool)

- Route: `POST /api/push/developer/send`
- Headers:
  - `Authorization: Bearer <developer token>`
  - `Content-Type: application/json`
- Request:

```json
{
  "userID": "user_123",
  "title": "Payday Update",
  "body": "Your payout was processed."
}
```

- Response:

```json
{
  "ok": true,
  "queued": 1,
  "messageId": "msg_123"
}
```

## 4) Backend APNs Delivery Notes

- Use APNs HTTP/2 endpoint:
  - Sandbox: `api.sandbox.push.apple.com`
  - Production: `api.push.apple.com`
- Use token-based auth (`.p8`, Key ID, Team ID).
- Required headers per send:
  - `apns-topic`: app bundle ID
  - `apns-push-type`: `alert`
  - `apns-priority`: `10`
- Payload:

```json
{
  "aps": {
    "alert": {
      "title": "Payday Update",
      "body": "Your payout was processed."
    },
    "sound": "default"
  }
}
```

## 5) Security Minimums

- Never expose APNs keys client-side.
- Rotate developer auth tokens.
- Rate limit `developer/send`.
- Audit-log sender, target `userID`, and payload metadata.
- Require role check (developer/admin) on CRM send endpoint.
