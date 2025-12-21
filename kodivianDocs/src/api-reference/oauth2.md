# Oauth2

**POST** `/oauth2/authorize/:credentialId`

Initiate OAuth2 authorization flow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credentialId` | string | Yes | The ID of the credential. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Authorization URL generated successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "success": true,
  "message": "Authorization URL generated successfully",
  "credentialId": "cred-123",
  "authorizationUrl": "https://provider.com/oauth/authorize?...",
  "redirectUri": "https://api.com/oauth2/callback"
}
```

---

**GET** `/oauth2/callback`

Handle OAuth2 callback.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `code` | string | Yes | The authorization code. |
| `state` | string | Yes | The state parameter (credential ID). |
| `error` | string | No | Error code if failed. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Callback handled successfully (HTML) |
| **400** | Invalid input or error |
| **500** | Internal server error |

## Examples

### Response (200)

HTML content closing the popup.

---

**POST** `/oauth2/refresh/:credentialId`

Refresh OAuth2 access token.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credentialId` | string | Yes | The ID of the credential. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Token refreshed successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "success": true,
  "message": "OAuth2 token refreshed successfully",
  "credentialId": "cred-123",
  "tokenInfo": {
    "access_token": "new-token",
    "expires_in": 3600
  }
}
```

