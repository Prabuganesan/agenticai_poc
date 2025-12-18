# Attachments

**POST** `/attachments/:chatflowId/:chatId`

Upload files to a chat session and extract their content.

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatflowId` | string | Yes | The GUID of the chatflow. |
| `chatId` | string | Yes | The ID of the chat session. |

## Body Parameters (Multipart/Form-Data)

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `files` | file | Yes | One or more files to upload. |
| `base64` | boolean | No | If true, returns the file content as a base64 string instead of extracted text. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Files uploaded and processed successfully |
| **400** | Invalid input or file type not allowed |
| **401** | Unauthorized |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Request

**Content-Type:** `multipart/form-data`

```text
files: [binary_file_data]
base64: false
```

### Response (200)

```json
[
  {
    "name": "document.pdf",
    "mimeType": "application/pdf",
    "size": 12345,
    "content": "Extracted text content from the PDF..."
  },
  {
    "name": "image.png",
    "mimeType": "image/png",
    "size": 54321,
    "content": "base64_encoded_string_if_base64_param_is_true"
  }
]
```

