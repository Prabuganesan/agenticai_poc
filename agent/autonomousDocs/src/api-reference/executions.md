# Executions

**GET** `/executions`

Get all executions.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |
| `guid` | string | No | Filter by execution GUID. |
| `agentflowId` | string | No | Filter by agentflow ID. |
| `agentflowName` | string | No | Filter by agentflow name. |
| `sessionId` | string | No | Filter by session ID. |
| `state` | string | No | Filter by execution state (`INPROGRESS`, `FINISHED`, `ERROR`, `TERMINATED`, `TIMEOUT`, `STOPPED`). |
| `startDate` | string | No | Filter by start date. |
| `endDate` | string | No | Filter by end date. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Executions retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "execution-guid-12345",
    "agentflowId": "flow-guid-12345",
    "state": "FINISHED",
    "created_on": 1700000000000
  }
]
```

---

**GET** `/executions/:id`

Get a specific execution by ID.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the execution. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Execution retrieved successfully |
| **404** | Execution not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": 1,
  "guid": "execution-guid-12345",
  "agentflowId": "flow-guid-12345",
  "state": "FINISHED",
  "created_on": 1700000000000
}
```

---

**PUT** `/executions/:id`

Update an execution.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the execution to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `state` | string | No | New state of the execution. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Execution updated successfully |
| **400** | Invalid input |
| **404** | Execution not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "state": "STOPPED"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "execution-guid-12345",
  "state": "STOPPED",
  "created_on": 1700000000000
}
```

---

**DELETE** `/executions/:id`

Delete a specific execution.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the execution to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Execution deleted successfully |
| **404** | Execution not found |
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

**DELETE** `/executions`

Delete multiple executions.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `executionIds` | array | Yes | Array of execution GUIDs to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Executions deleted successfully |
| **400** | Invalid input |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "executionIds": ["execution-guid-1", "execution-guid-2"]
}
```

### Response (200)

```json
{
  "raw": [],
  "affected": 2
}
```

