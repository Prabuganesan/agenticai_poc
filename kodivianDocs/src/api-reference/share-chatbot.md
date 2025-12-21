# Share Chatbot

**GET** `/share-chatbot/:id`

Share a chatbot session.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chat session. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Session shared successfully (HTML redirect) |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

HTML content that sets up the session and redirects to the chatbot.

