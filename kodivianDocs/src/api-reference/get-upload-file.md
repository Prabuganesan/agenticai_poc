# Get Upload File

**GET** `/get-upload-file`

Stream an uploaded file.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `chatflowId` | string | Yes | The ID of the chatflow. |
| `chatId` | string | Yes | The ID of the chat session. |
| `fileName` | string | Yes | The name of the file to stream. |
| `download` | boolean | No | If true, force download as attachment. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | File streamed successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **404** | File not found |
| **500** | Internal server error |

## Examples

### Response (200)

Binary file content.

