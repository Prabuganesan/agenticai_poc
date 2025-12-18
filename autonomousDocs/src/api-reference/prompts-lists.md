# Prompts Lists

**POST** `/prompts-lists`

Fetch prompts list from LangChain Hub.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `tags` | string | No | Filter prompts by tags. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Prompts retrieved successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "tags": "rag"
}
```

### Response (200)

```json
{
  "status": "OK",
  "repos": [
    {
      "id": 123,
      "name": "rag-prompt",
      "description": "A prompt for RAG",
      "tags": ["rag"]
    }
  ]
}
```

