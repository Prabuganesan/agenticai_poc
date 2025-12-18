# Node Custom Functions

**POST** `/node-custom-functions`

Execute a custom function for a node.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `functionName` | string | Yes | The name of the function to execute. |
| `args` | object | No | Arguments for the function. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Function executed successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "functionName": "myCustomFunction",
  "args": {
    "input": "test"
  }
}
```

### Response (200)

```json
{
  "result": "Function executed"
}
```

