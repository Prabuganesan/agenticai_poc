# Node Load Methods

**POST** `/node-load-methods/:name`

Get async options for a node.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | The name of the node. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `options` | object | No | Options for loading. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Options retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "credentialId": "cred-123"
}
```

### Response (200)

```json
[
  {
    "label": "Option 1",
    "name": "option1",
    "description": "Description for option 1"
  }
]
```

