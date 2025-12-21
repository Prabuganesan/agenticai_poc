# Chatflows Streaming

**GET** `/chatflows-streaming/:id`

Check if a chatflow is valid for streaming.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflow is valid for streaming |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "isStreaming": true
}
```

