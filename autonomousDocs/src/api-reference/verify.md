# Verify

**GET** `/verify/apikey/:apikey`

Verify an API key.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `apikey` | string | Yes | The API key to verify. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | API key verified successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "result": true
}
```

