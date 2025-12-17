# Nodes

**GET** `/nodes`

Get all available nodes.
 

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Nodes retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "name": "chatOpenAI",
    "label": "ChatOpenAI",
    "category": "Chat Models",
    "description": "Wrapper around OpenAI Chat large language models"
  }
]
```

---

**GET** `/nodes/:name`

Get a specific node by name.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | The name of the node. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Node retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "name": "chatOpenAI",
  "label": "ChatOpenAI",
  "category": "Chat Models",
  "description": "Wrapper around OpenAI Chat large language models",
  "inputs": [],
  "outputs": []
}
```

---

**GET** `/nodes/category/:name`

Get all nodes in a specific category.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | The name of the category. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Nodes retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "name": "chatOpenAI",
    "label": "ChatOpenAI",
    "category": "Chat Models"
  }
]
```

