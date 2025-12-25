# Auth

**GET** `/auth/permissions`

Get user permissions. For the kodivian server, this currently returns an empty array as all authenticated users have global access.

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Permissions retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[]
```

