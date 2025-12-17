# Public Executions

**GET** `/public-executions/:id`

Get a public execution by ID.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the execution. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Execution retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": "exec_123",
  "status": "FINISHED",
  "result": "Execution result"
}
```

