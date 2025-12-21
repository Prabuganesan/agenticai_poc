# Agentflow Generator

**POST** `/agentflow-generator/generate`

Generate a new Agentflow structure (nodes and edges) based on a natural language description using a selected chat model.

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `question` | string | Yes | The natural language description of the agent flow you want to generate.<br>_Example: "Create a research agent that searches the web and summarizes results."_ |
| `selectedChatModel` | object | Yes | Configuration for the chat model to use for generation.<br>_Example: `{ "name": "gpt-4", "temperature": 0.7 }`_ |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Agentflow generated successfully |
| **400** | Missing required parameters (question or selectedChatModel) |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "question": "Create a research agent that searches the web",
  "selectedChatModel": {
    "name": "gpt-4",
    "temperature": 0.7,
    "id": "chat-model-id"
  }
}
```

### Response (200)

```json
{
  "description": "A research agent flow...",
  "usecases": [
    "Search web for topics",
    "Summarize findings"
  ],
  "nodes": [
    {
      "id": "node-1",
      "type": "agent",
      "position": { "x": 0, "y": 0 },
      "data": { "label": "Research Agent" },
      "width": 300,
      "height": 150
    }
  ],
  "edges": []
}
```

