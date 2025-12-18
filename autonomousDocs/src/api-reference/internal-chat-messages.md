# Internal Chat Messages

**GET** `/internal-chat-messages/:id`

Get all internal chat messages for a specific chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatId` | string | No | Filter by chat ID. |
| `memoryType` | string | No | Filter by memory type. |
| `sessionId` | string | No | Filter by session ID. |
| `startDate` | string | No | Filter by start date. |
| `endDate` | string | No | Filter by end date. |
| `order` | string | No | Sort order (`ASC` or `DESC`). |
| `feedback` | boolean | No | Filter by feedback presence. |
| `feedbackType` | array | No | Filter by feedback type (`THUMBS_UP`, `THUMBS_DOWN`). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chat messages retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "role": "user",
    "content": "Hello",
    "chatflowid": "chatflow-guid-12345",
    "chatType": "INTERNAL",
    "created_on": 1700000000000
  }
]
```

