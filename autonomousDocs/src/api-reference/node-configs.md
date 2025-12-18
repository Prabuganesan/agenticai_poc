# Node Configs

**POST** `/node-configs`

Get configuration for a node.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `value` | object | Yes | The node parameters to configure. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Config retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "database": "postgres",
  "host": "localhost"
}
```

### Response (200)

```json
{
  "tables": ["users", "posts"]
}
```

