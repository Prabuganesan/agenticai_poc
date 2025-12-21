# Stats

**GET** `/stats/:id`

Get statistics for a specific chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatType` | string | No | Filter by chat type (e.g., `INTERNAL`, `EXTERNAL`). |
| `startDate` | string | No | Filter by start date. |
| `endDate` | string | No | Filter by end date. |
| `feedbackType` | string | No | Filter by feedback type (`THUMBS_UP`, `THUMBS_DOWN`). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Stats retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "totalMessages": 100,
  "totalConversations": 20,
  "totalFeedback": 10,
  "positiveFeedback": 8,
  "negativeFeedback": 2
}
```

