# Components Credentials

**GET** `/components-credentials`

List all available component credentials.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Credentials listed successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "name": "openAIApi",
    "label": "OpenAI API",
    "description": "Credential for OpenAI API",
    "inputs": []
  }
]
```

---

**GET** `/components-credentials/:name`

Get a specific component credential by name.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | The name of the component credential. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Credential retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "name": "openAIApi",
  "label": "OpenAI API",
  "description": "Credential for OpenAI API",
  "inputs": []
}
```

