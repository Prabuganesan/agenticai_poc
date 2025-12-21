# OpenAI Realtime

**GET** `/openai-realtime/:id`

Get agent tools for OpenAI Realtime.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Tools retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "name": "calculator",
    "description": "A simple calculator",
    "parameters": {
      "type": "object",
      "properties": {
        "expression": {
          "type": "string"
        }
      }
    }
  }
]
```

---

**POST** `/openai-realtime/:id`

Execute an agent tool for OpenAI Realtime.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | Yes | The ID of the chat session. |
| `toolName` | string | Yes | The name of the tool to execute. |
| `inputArgs` | object | Yes | The arguments for the tool. |
| `apiMessageId` | string | No | The ID of the API message. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Tool executed successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatId": "session-123",
  "toolName": "calculator",
  "inputArgs": {
    "expression": "2 + 2"
  }
}
```

### Response (200)

```json
{
  "result": "4"
}
```

