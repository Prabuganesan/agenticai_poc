# Internal Predictions

**POST** `/internal-predictions/:id`

Send input message to a chatflow and get prediction results (Internal).
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `question` | string | Yes | The input question or message. |
| `chatId` | string | No | The ID of the chat session. |
| `streaming` | boolean | No | Whether to stream the response. |
| `history` | array | No | Chat history. |
| `overrideConfig` | object | No | Configuration overrides. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Prediction successful |
| **400** | Invalid input |
| **401** | Unauthorized |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "question": "Hello, how are you?",
  "chatId": "session-123",
  "streaming": false
}
```

### Response (200)

```json
{
  "text": "I am doing well, thank you!",
  "chatId": "session-123",
  "question": "Hello, how are you?"
}
```

