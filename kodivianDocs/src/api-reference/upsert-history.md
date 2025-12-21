# Upsert History

**GET** `/upsert-history`

Get all upsert history.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `order` | string | No | Sort order (ASC or DESC). |
| `startDate` | string | No | Start date filter. |
| `endDate` | string | No | End date filter. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | History retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "history_123",
    "chatflowid": "flow_123",
    "result": "Upserted 5 documents",
    "flowData": "...",
    "date": "2023-01-01T00:00:00.000Z"
  }
]
```

---

**GET** `/upsert-history/:id`

Get upsert history for a specific chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `order` | string | No | Sort order (ASC or DESC). |
| `startDate` | string | No | Start date filter. |
| `endDate` | string | No | End date filter. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | History retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "history_123",
    "chatflowid": "flow_123",
    "result": "Upserted 5 documents",
    "flowData": "...",
    "date": "2023-01-01T00:00:00.000Z"
  }
]
```

---

**PATCH** `/upsert-history`

Delete upsert history items.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `ids` | array | Yes | Array of history IDs to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | History deleted successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "ids": ["history_123", "history_456"]
}
```

### Response (200)

```json
{
  "affected": 2
}
```

