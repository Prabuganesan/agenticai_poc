# Vector Upsert

**POST** `/vector/upsert/:id`

Upsert data into a vector store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chatflow. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `files` | array | No | Array of files to upload (multipart/form-data). |
| `overrideConfig` | object | No | Configuration to override. |
| `stopNodeId` | string | No | The ID of the node to stop at. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Upsert successful |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "result": "Successfully upserted 5 documents",
  "numAdded": 5,
  "numUpdated": 0,
  "numSkipped": 0,
  "numDeleted": 0
}
```

---

**POST** `/vector/internal-upsert/:id`

Internal upsert data into a vector store.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chatflow. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `files` | array | No | Array of files to upload (multipart/form-data). |
| `overrideConfig` | object | No | Configuration to override. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Upsert successful |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "result": "Successfully upserted 5 documents",
  "numAdded": 5,
  "numUpdated": 0,
  "numSkipped": 0,
  "numDeleted": 0
}
```
