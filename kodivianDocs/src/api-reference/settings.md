# Settings

**GET** `/settings`

Get system settings.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Settings retrieved successfully |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "chatflow": {
    "maxMessages": 100
  },
  "general": {
    "theme": "dark"
  }
}
```

