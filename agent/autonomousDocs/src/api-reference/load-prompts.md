# Load Prompts

**POST** `/load-prompts`

Load a prompt from LangChain Hub.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `promptName` | string | Yes | The name of the prompt to load. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Prompt loaded successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "promptName": "efriis/my-prompt"
}
```

### Response (200)

```json
{
  "template": "This is a prompt template",
  "input_variables": ["input"]
}
```

