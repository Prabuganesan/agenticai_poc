# OpenAI Assistants

**GET** `/openai-assistants`

List available OpenAI assistants.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Assistants retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": "asst_123",
    "object": "assistant",
    "created_at": 1700000000,
    "name": "My Assistant",
    "description": null,
    "model": "gpt-4-1106-preview",
    "instructions": "You are a helpful assistant.",
    "tools": [],
    "file_ids": [],
    "metadata": {}
  }
]
```

---

**GET** `/openai-assistants/:id`

Get a specific OpenAI assistant.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The ID of the assistant. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credential` | string | Yes | The ID of the credential to use. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Assistant retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": "asst_123",
  "object": "assistant",
  "created_at": 1700000000,
  "name": "My Assistant",
  "description": null,
  "model": "gpt-4-1106-preview",
  "instructions": "You are a helpful assistant.",
  "tools": [],
  "file_ids": [],
  "metadata": {}
}
```

