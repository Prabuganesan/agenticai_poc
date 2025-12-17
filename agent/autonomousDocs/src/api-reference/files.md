# Files

**GET** `/files`

Get all files in storage.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Files retrieved successfully |
| **404** | Organization not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "name": "document.pdf",
    "type": "file",
    "path": "folder/document.pdf",
    "size": 1024,
    "created_on": 1700000000000
  }
]
```

---

**DELETE** `/files`

Delete a specific file.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `path` | string | Yes | Path of the file to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | File deleted successfully |
| **404** | Organization not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "message": "file_deleted"
}
```

