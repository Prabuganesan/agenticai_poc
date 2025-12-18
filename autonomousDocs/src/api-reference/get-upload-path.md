# Get Upload Path

**GET** `/get-upload-path`

Get the storage path for uploads.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Path retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "storagePath": "/path/to/uploads"
}
```

