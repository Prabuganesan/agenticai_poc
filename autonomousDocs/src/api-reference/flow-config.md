# Flow Config

**GET** `/flow-config/:id`

Get configuration for a chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Config retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "chatflowId": "chatflow-123",
  "chatflowConfig": "{}"
}
```

