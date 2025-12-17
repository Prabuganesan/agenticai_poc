# Chat Message

**GET** `/chatmessage/:id`

Get all chat messages for a specific chatflow.

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatType` | string | No | Filter by chat type (e.g., `INTERNAL`, `EXTERNAL`). |
| `chatId` | string | No | Filter by specific chat session ID. |
| `memoryType` | string | No | Filter by memory type. |
| `sessionId` | string | No | Filter by session ID. |
| `startDate` | string | No | Filter messages after this date. |
| `endDate` | string | No | Filter messages before this date. |
| `order` | string | No | Sort order (`ASC` or `DESC`). |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat messages retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "role": "user",
    "content": "Hello",
    "chatflowid": "chatflow-id",
    "chatType": "INTERNAL",
    "chatId": "chat-id",
    "createdDate": "2023-01-01T00:00:00.000Z"
  },
  {
    "role": "apiMessage",
    "content": "Hi there!",
    "chatflowid": "chatflow-id",
    "chatType": "INTERNAL",
    "chatId": "chat-id",
    "createdDate": "2023-01-01T00:00:01.000Z"
  }
]
```

---

**DELETE** `/chatmessage/:id`

Delete chat messages for a specific chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | No | Delete messages for a specific chat session ID. |
| `sessionId` | string | No | Delete messages for a specific session ID. |
| `memoryType` | string | No | Delete messages for a specific memory type. |
| `chatType` | string | No | Delete messages for a specific chat type. |
| `startDate` | string | No | Delete messages after this date. |
| `endDate` | string | No | Delete messages before this date. |
| `hardDelete` | boolean | No | If true, also clears session memory from third-party integrations. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat messages deleted successfully |
| **401** | Unauthorized |
| **404** | Chatflow not found |
| **500** | Internal server error |

---

**PUT** `/chatmessage/abort/:chatflowid/:chatid`

Abort a running chat message generation.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatflowid` | string | Yes | The ID of the chatflow. |
| `chatid` | string | Yes | The ID of the chat session. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat message aborted successfully |
| **400** | Missing required parameters |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "status": 200,
  "message": "Chat message aborted"
}
```

