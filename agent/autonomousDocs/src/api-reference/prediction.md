# Prediction

**POST** `/prediction/:id`

Send input message to a chatflow and get a prediction result.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `question` | string | Yes | The input message or question. |
| `chatId` | string | No | The ID of the chat session. If not provided, a new one will be generated. |
| `streaming` | boolean | No | If true, the response will be streamed using Server-Sent Events (SSE). |
| `history` | array | No | Array of previous messages for context. |
| `overrideConfig` | object | No | Object to override specific node configurations. |
| `socketIOClientId` | string | No | Client ID for Socket.IO connection. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Successful prediction |
| **400** | Invalid input |
| **401** | Unauthorized |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "question": "What is the capital of France?",
  "chatId": "session-guid-12345",
  "streaming": false
}
```

### Response (200)

```json
{
  "text": "The capital of France is Paris.",
  "question": "What is the capital of France?",
  "chatId": "session-guid-12345",
  "chatMessageId": "message-guid-12345",
  "sessionId": "session-guid-12345",
  "memoryType": "BufferMemory"
}
```

