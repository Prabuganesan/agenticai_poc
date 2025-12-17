# Document Store

**POST** `/document-store/store`

Create a new document store.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | Name of the document store. |
| `description` | string | No | Description of the document store. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Document store created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "My Document Store",
  "description": "Store for company policies"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "docstore-guid-12345",
  "name": "My Document Store",
  "description": "Store for company policies",
  "created_on": 1700000000000
}
```

---

**GET** `/document-store/store`

Get all document stores.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Document stores retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "docstore-guid-12345",
    "name": "My Document Store",
    "description": "Store for company policies",
    "created_on": 1700000000000
  }
]
```

---

**GET** `/document-store/store/:id`

Get a specific document store by ID.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the document store. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Document store retrieved successfully |
| **404** | Document store not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": 1,
  "guid": "docstore-guid-12345",
  "name": "My Document Store",
  "description": "Store for company policies",
  "created_on": 1700000000000
}
```

---

**PUT** `/document-store/store/:id`

Update a document store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the document store to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | No | Name of the document store. |
| `description` | string | No | Description of the document store. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Document store updated successfully |
| **400** | Invalid input |
| **404** | Document store not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "description": "Updated description"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "docstore-guid-12345",
  "name": "My Document Store",
  "description": "Updated description",
  "created_on": 1700000000000,
  "last_modified_on": 1700000001000
}
```

---

**DELETE** `/document-store/store/:id`

Delete a document store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the document store to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Document store deleted successfully |
| **404** | Document store not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "raw": [],
  "affected": 1
}
```

---

**POST** `/document-store/upsert/:id`

Upsert files to a document store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the document store. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `files` | array | Yes | Array of files to upload. |
| `metadata` | object | No | Metadata for the files. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Files upserted successfully |
| **400** | Invalid input |
| **404** | Document store not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "added": 5,
  "updated": 0,
  "deleted": 0
}
```

---

**POST** `/document-store/refresh/:id`

Refresh a document store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the document store. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Document store refreshed successfully |
| **404** | Document store not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "refreshed": true
}
```

---

**POST** `/document-store/vectorstore/query`

Query the vector store.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `query` | string | Yes | The query string. |
| `storeId` | string | Yes | The GUID of the document store. |
| `topK` | number | No | Number of results to return. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Query successful |
| **400** | Invalid input |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "query": "What is the company policy on remote work?",
  "storeId": "docstore-guid-12345",
  "topK": 3
}
```

### Response (200)

```json
[
  {
    "pageContent": "Remote work is allowed...",
    "metadata": {
      "source": "policy.pdf"
    }
  }
]
```
