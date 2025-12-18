# OpenAI Assistants Vector Store

**GET** `/openai-assistants-vector-store`

List available OpenAI assistant vector stores.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Vector stores retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "vs_123",
    "object": "vector_store",
    "created_at": 1700000000,
    "name": "My Vector Store",
    "usage_bytes": 1024,
    "file_counts": {
      "in_progress": 0,
      "completed": 1,
      "failed": 0,
      "cancelled": 0,
      "total": 1
    },
    "status": "completed",
    "expires_after": null,
    "expires_at": null,
    "last_active_at": 1700000000,
    "metadata": {}
  }
]
```

---

**GET** `/openai-assistants-vector-store/:id`

Get a specific OpenAI assistant vector store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the vector store. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Vector store retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": "vs_123",
  "object": "vector_store",
  "created_at": 1700000000,
  "name": "My Vector Store",
  "usage_bytes": 1024,
  "file_counts": {
    "in_progress": 0,
    "completed": 1,
    "failed": 0,
    "cancelled": 0,
    "total": 1
  },
  "status": "completed",
  "expires_after": null,
  "expires_at": null,
  "last_active_at": 1700000000,
  "metadata": {}
}
```

---

**POST** `/openai-assistants-vector-store`

Create a new OpenAI assistant vector store.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | No | The name of the vector store. |
| `file_ids` | array | No | A list of file IDs to add to the vector store. |
| `metadata` | object | No | Set of 16 key-value pairs that can be attached to an object. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Vector store created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "My Vector Store",
  "file_ids": ["file-123"]
}
```

### Response (200)

```json
{
  "id": "vs_123",
  "object": "vector_store",
  "created_at": 1700000000,
  "name": "My Vector Store",
  "usage_bytes": 0,
  "file_counts": {
    "in_progress": 0,
    "completed": 0,
    "failed": 0,
    "cancelled": 0,
    "total": 0
  },
  "status": "in_progress",
  "expires_after": null,
  "expires_at": null,
  "last_active_at": 1700000000,
  "metadata": {}
}
```

---

**PUT** `/openai-assistants-vector-store/:id`

Update an OpenAI assistant vector store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the vector store. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | No | The name of the vector store. |
| `metadata` | object | No | Set of 16 key-value pairs that can be attached to an object. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Vector store updated successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "Updated Vector Store"
}
```

### Response (200)

```json
{
  "id": "vs_123",
  "object": "vector_store",
  "created_at": 1700000000,
  "name": "Updated Vector Store",
  "usage_bytes": 1024,
  "file_counts": {
    "in_progress": 0,
    "completed": 1,
    "failed": 0,
    "cancelled": 0,
    "total": 1
  },
  "status": "completed",
  "expires_after": null,
  "expires_at": null,
  "last_active_at": 1700000000,
  "metadata": {}
}
```

---

**DELETE** `/openai-assistants-vector-store/:id`

Delete an OpenAI assistant vector store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the vector store. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Vector store deleted successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": "vs_123",
  "object": "vector_store.deleted",
  "deleted": true
}
```

---

**POST** `/openai-assistants-vector-store/:id`

Upload files to an OpenAI assistant vector store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the vector store. |

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
    "object": "vector_store.file",
    "created_at": 1700000000,
    "vector_store_id": "vs_123",
    "status": "in_progress",
    "last_error": null
  }
]
```

---

**PATCH** `/openai-assistants-vector-store/:id`

Delete files from an OpenAI assistant vector store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the vector store. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `file_ids` | array | Yes | Array of file IDs to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Files deleted successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "file_ids": ["file-123"]
}
```

### Response (200)

```json
[
  {
    "id": "file-123",
    "object": "vector_store.file.deleted",
    "deleted": true
  }
]
```

