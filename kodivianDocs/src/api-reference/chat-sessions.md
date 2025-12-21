# Chat Sessions

**POST** `/chat-sessions/create`

Create a new chat session.

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatflowId` | string | Yes | The GUID of the chatflow. |
| `title` | string | No | The title of the chat session. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat session created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatflowId": "chatflow-guid-12345",
  "title": "My New Session"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "session-guid-12345",
  "chatflowId": "chatflow-guid-12345",
  "title": "My New Session",
  "created_on": 1700000000000
}
```

---

**POST** `/chat-sessions/list`

List all chat sessions for a chatflow.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatflowId` | string | Yes | The GUID of the chatflow. |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat sessions retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatflowId": "chatflow-guid-12345",
  "page": 1,
  "limit": 10
}
```

### Response (200)

```json
{
  "sessions": [
    {
      "id": 1,
      "guid": "session-guid-12345",
      "chatflowId": "chatflow-guid-12345",
      "title": "My New Session",
      "created_on": 1700000000000
    }
  ],
  "sessionsCount": 1,
  "total": 1,
  "data": [
    {
      "id": 1,
      "guid": "session-guid-12345",
      "chatflowId": "chatflow-guid-12345",
      "title": "My New Session",
      "created_on": 1700000000000
    }
  ]
}
```

---

**POST** `/chat-sessions/get`

Get a specific chat session by ID.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | Yes | The GUID of the chat session. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat session retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **404** | Chat session not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatId": "session-guid-12345"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "session-guid-12345",
  "chatflowId": "chatflow-guid-12345",
  "title": "My New Session",
  "created_on": 1700000000000
}
```

---

**POST** `/chat-sessions/update`

Update a chat session.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | Yes | The GUID of the chat session. |
| `title` | string | No | The new title of the chat session. |
| `preview` | string | No | The new preview text of the chat session. |
| `messageCount` | number | No | The new message count of the chat session. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat session updated successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatId": "session-guid-12345",
  "title": "Updated Session Title"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "session-guid-12345",
  "chatflowId": "chatflow-guid-12345",
  "title": "Updated Session Title",
  "created_on": 1700000000000
}
```

---

**POST** `/chat-sessions/delete`

Delete a chat session.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | Yes | The GUID of the chat session to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat session deleted successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatId": "session-guid-12345"
}
```

### Response (200)

```json
{
  "success": true,
  "message": "Chat session deleted successfully"
}
```

