# Credentials

**POST** `/credentials`

Create a new credential.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | Name of the credential instance. |
| `credentialName` | string | Yes | Type of the credential (e.g., `openAIApi`). |
| `plainDataObj` | object | Yes | Object containing the actual credential data (e.g., API keys). |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Credential created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "My OpenAI Key",
  "credentialName": "openAIApi",
  "plainDataObj": {
    "openAIApiKey": "sk-..."
  }
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "credential-guid-12345",
  "name": "My OpenAI Key",
  "credentialName": "openAIApi",
  "created_on": 1700000000000
}
```

---

**GET** `/credentials`

Get all credentials.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `credentialName` | string | No | Filter by credential type. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Credentials retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "credential-guid-12345",
    "name": "My OpenAI Key",
    "credentialName": "openAIApi",
    "created_on": 1700000000000
  }
]
```

---

**GET** `/credentials/:id`

Get a specific credential by ID.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the credential. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Credential retrieved successfully |
| **404** | Credential not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": 1,
  "guid": "credential-guid-12345",
  "name": "My OpenAI Key",
  "credentialName": "openAIApi",
  "created_on": 1700000000000
}
```

---

**PUT** `/credentials/:id`

Update an existing credential.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the credential to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | No | Name of the credential instance. |
| `credentialName` | string | No | Type of the credential. |
| `plainDataObj` | object | No | Object containing the actual credential data. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Credential updated successfully |
| **400** | Invalid input |
| **404** | Credential not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "Updated OpenAI Key",
  "plainDataObj": {
    "openAIApiKey": "sk-new-key..."
  }
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "credential-guid-12345",
  "name": "Updated OpenAI Key",
  "credentialName": "openAIApi",
  "created_on": 1700000000000,
  "last_modified_on": 1700000001000
}
```

---

**DELETE** `/credentials/:id`

Delete a credential.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the credential to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Credential deleted successfully |
| **404** | Credential not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "raw": [],
  "affected": 1
}
```

