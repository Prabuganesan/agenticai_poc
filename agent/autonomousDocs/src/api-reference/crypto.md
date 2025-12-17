# Crypto

**GET** `/crypto/public-key`

Get RSA public key for client encryption.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Public key retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\n..."
}
```

---

**GET** `/crypto/status`

Get encryption status.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Status retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "enabled": true
}
```

---

**POST** `/crypto/handshake`

Perform session key handshake.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `encryptedSessionKey` | string | Yes | The session key encrypted with the public key. |
| `sessionId` | string | Yes | The session ID. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Handshake successful |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "encryptedSessionKey": "encrypted-key-data",
  "sessionId": "session-123"
}
```

### Response (200)

```json
{
  "success": true
}
```

