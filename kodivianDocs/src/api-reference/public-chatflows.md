# Public Chatflows

**GET** `/public-chatflows/:id`

Get a specific public chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflow retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": 1,
  "guid": "chatflow-guid-12345",
  "name": "My Public Chatflow",
  "flowData": "...",
  "isPublic": true,
  "created_on": 1700000000000
}
```

