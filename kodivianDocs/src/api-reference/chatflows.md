# Chatflows

**POST** `/chatflows`

Create a new chatflow.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | Name of the chatflow. |
| `flowData` | string | Yes | JSON stringified object containing the flow configuration (nodes, edges, viewport). |
| `deployed` | boolean | No | Whether the chatflow is deployed. |
| `isPublic` | boolean | No | Whether the chatflow is public. |
| `apikeyid` | string | No | ID of the API key associated with the chatflow. |
| `chatbotConfig` | string | No | JSON stringified object containing chatbot configuration. |
| `apiConfig` | string | No | JSON stringified object containing API configuration. |
| `analytic` | string | No | JSON stringified object containing analytic configuration. |
| `speechToText` | string | No | JSON stringified object containing speech-to-text configuration. |
| `textToSpeech` | string | No | JSON stringified object containing text-to-speech configuration. |
| `type` | string | No | Type of chatflow (e.g., `CHATFLOW`, `AGENTFLOW`, `MULTIAGENT`). Defaults to `CHATFLOW`. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflow created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "My Chatflow",
  "flowData": "{\"nodes\":[],\"edges\":[],\"viewport\":{\"x\":0,\"y\":0,\"zoom\":1}}",
  "deployed": false,
  "isPublic": false,
  "type": "CHATFLOW"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "chatflow-guid-12345",
  "name": "My Chatflow",
  "flowData": "{\"nodes\":[],\"edges\":[],\"viewport\":{\"x\":0,\"y\":0,\"zoom\":1}}",
  "deployed": false,
  "isPublic": false,
  "type": "CHATFLOW",
  "created_on": 1700000000000
}
```

---

**GET** `/chatflows`

Get all chatflows.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | No | Filter by chatflow type (e.g., `CHATFLOW`, `MULTIAGENT`). |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflows retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "chatflow-guid-12345",
    "name": "My Chatflow",
    "flowData": "{\"nodes\":[],\"edges\":[],\"viewport\":{\"x\":0,\"y\":0,\"zoom\":1}}",
    "deployed": false,
    "isPublic": false,
    "type": "CHATFLOW",
    "created_on": 1700000000000
  }
]
```

---

**GET** `/chatflows/:id`

Get a specific chatflow by ID.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflow retrieved successfully |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": 1,
  "guid": "chatflow-guid-12345",
  "name": "My Chatflow",
  "flowData": "{\"nodes\":[],\"edges\":[],\"viewport\":{\"x\":0,\"y\":0,\"zoom\":1}}",
  "deployed": false,
  "isPublic": false,
  "type": "CHATFLOW",
  "created_on": 1700000000000
}
```

---

**GET** `/chatflows/apikey/:apikey`

Get a chatflow by API key.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `apikey` | string | Yes | The API key associated with the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `keyonly` | boolean | No | If true, returns only minimal chatflow information. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflow retrieved successfully |
| **401** | Unauthorized |
| **404** | Chatflow not found |
| **500** | Internal server error |

---

**PUT** `/chatflows/:id`

Update an existing chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | No | Name of the chatflow. |
| `flowData` | string | No | JSON stringified object containing the flow configuration. |
| `deployed` | boolean | No | Whether the chatflow is deployed. |
| `isPublic` | boolean | No | Whether the chatflow is public. |
| `apikeyid` | string | No | ID of the API key associated with the chatflow. |
| `chatbotConfig` | string | No | JSON stringified object containing chatbot configuration. |
| `apiConfig` | string | No | JSON stringified object containing API configuration. |
| `analytic` | string | No | JSON stringified object containing analytic configuration. |
| `speechToText` | string | No | JSON stringified object containing speech-to-text configuration. |
| `textToSpeech` | string | No | JSON stringified object containing text-to-speech configuration. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflow updated successfully |
| **400** | Invalid input |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "Updated Chatflow Name",
  "deployed": true
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "chatflow-guid-12345",
  "name": "Updated Chatflow Name",
  "flowData": "{\"nodes\":[],\"edges\":[],\"viewport\":{\"x\":0,\"y\":0,\"zoom\":1}}",
  "deployed": true,
  "isPublic": false,
  "type": "CHATFLOW",
  "created_on": 1700000000000,
  "last_modified_on": 1700000001000
}
```

---

**DELETE** `/chatflows/:id`

Delete a chatflow.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Chatflow deleted successfully |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "raw": [],
  "affected": 1
}
```

---

**GET** `/chatflows/has-changed/:id`

Check if a chatflow has changed since a specific time.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the chatflow. |

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `lastUpdatedDateTime` | string | No | The timestamp to compare against. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Returns true if changed, false otherwise |
| **404** | Chatflow not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
true
```

