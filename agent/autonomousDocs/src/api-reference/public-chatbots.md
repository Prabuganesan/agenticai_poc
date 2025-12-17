# Public Chatbots

**GET** `/public-chatbots/:id`

Get the configuration for a public chatbot.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Configuration retrieved successfully |
| **400** | Invalid input |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "chatflowId": "chatflow-guid-12345",
  "chatbotConfig": "...",
  "isPublic": true
}
```

---

**GET** `/public-chatbots/:id/theme`

Get the theme configuration for a public chatbot.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Theme retrieved successfully |
| **400** | Invalid input |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "button": {
    "backgroundColor": "#3B81F6",
    "right": 20,
    "bottom": 20
  },
  "chatWindow": {
    "title": "My Chatbot"
  }
}
```

