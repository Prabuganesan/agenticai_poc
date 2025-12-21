# Feedback

**POST** `/feedback`

Create a new feedback for a chat message.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatflowid` | string | Yes | The GUID of the chatflow. |
| `chatId` | string | Yes | The GUID of the chat session. |
| `messageId` | string | Yes | The GUID of the chat message. |
| `rating` | string | Yes | Rating of the message (`positive`, `negative`, `neutral`). |
| `content` | string | No | Additional feedback content. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Feedback created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatflowid": "chatflow-guid-12345",
  "chatId": "session-guid-12345",
  "messageId": "message-guid-12345",
  "rating": "positive",
  "content": "Great answer!"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "feedback-guid-12345",
  "chatflowid": "chatflow-guid-12345",
  "chatId": "session-guid-12345",
  "messageId": "message-guid-12345",
  "rating": "positive",
  "content": "Great answer!",
  "created_on": 1700000000000
}
```

---

**GET** `/feedback/:id`

Get all feedback for a specific chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | No | Filter by chat session ID. |
| `startDate` | string | No | Filter by start date. |
| `endDate` | string | No | Filter by end date. |
| `order` | string | No | Sort order (`ASC` or `DESC`). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Feedback retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "feedback-guid-12345",
    "chatflowid": "chatflow-guid-12345",
    "chatId": "session-guid-12345",
    "messageId": "message-guid-12345",
    "rating": "positive",
    "content": "Great answer!",
    "created_on": 1700000000000
  }
]
```

---

**PUT** `/feedback/:id`

Update an existing feedback.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the feedback to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `rating` | string | No | New rating (`positive`, `negative`, `neutral`). |
| `content` | string | No | New feedback content. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Feedback updated successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "rating": "negative",
  "content": "Actually, this was incorrect."
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "feedback-guid-12345",
  "chatflowid": "chatflow-guid-12345",
  "chatId": "session-guid-12345",
  "messageId": "message-guid-12345",
  "rating": "negative",
  "content": "Actually, this was incorrect.",
  "created_on": 1700000000000,
  "last_modified_on": 1700000001000
}
```

