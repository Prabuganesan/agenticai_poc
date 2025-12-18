# OpenAI Assistants Files

**POST** `/openai-assistants-files/download`

Download a file from an OpenAI assistant.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatflowId` | string | Yes | The GUID of the chatflow. |
| `chatId` | string | Yes | The ID of the chat session. |
| `fileName` | string | Yes | The name of the file to download. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | File downloaded successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "chatflowId": "chatflow-guid-12345",
  "chatId": "session-123",
  "fileName": "document.pdf"
}
```

### Response (200)

Binary file content.

---

**POST** `/openai-assistants-files/upload`

Upload files to an OpenAI assistant.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `files` | array | Yes | Array of files to upload (multipart/form-data). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Files uploaded successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "file-123",
    "object": "file",
    "bytes": 1024,
    "created_at": 1700000000,
    "filename": "document.pdf",
    "purpose": "assistants"
  }
]
```

