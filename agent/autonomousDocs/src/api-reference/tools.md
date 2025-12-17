# Tools

**POST** `/tools`

Create a new tool.
 

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | Yes | Name of the tool. |
| `description` | string | Yes | Description of what the tool does. |
| `schema` | string | No | JSON stringified schema definition for the tool. |
| `func` | string | No | The function code or definition. |
| `iconSrc` | string | No | URL or path to the tool's icon. |
| `color` | string | No | Color hex code for the tool UI. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Tool created successfully |
| **400** | Invalid input |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "name": "My Custom Tool",
  "description": "A tool that does something useful",
  "schema": "[{\"name\":\"arg1\",\"type\":\"string\"}]",
  "func": "return 'hello world';",
  "color": "#ff0000"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "tool-guid-12345",
  "name": "My Custom Tool",
  "description": "A tool that does something useful",
  "created_on": 1700000000000
}
```

---

**GET** `/tools`

Get all tools.
 

## Query Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `page` | number | No | Page number for pagination. |
| `limit` | number | No | Number of items per page. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Tools retrieved successfully |
| **401** | Unauthorized |
| **500** | Internal server error |

## Examples

### Response (200)

```json
[
  {
    "id": 1,
    "guid": "tool-guid-12345",
    "name": "My Custom Tool",
    "description": "A tool that does something useful",
    "created_on": 1700000000000
  }
]
```

---

**GET** `/tools/:id`

Get a specific tool by ID.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the tool. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Tool retrieved successfully |
| **404** | Tool not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "id": 1,
  "guid": "tool-guid-12345",
  "name": "My Custom Tool",
  "description": "A tool that does something useful",
  "created_on": 1700000000000
}
```

---

**PUT** `/tools/:id`

Update an existing tool.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the tool to update. |

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `name` | string | No | Name of the tool. |
| `description` | string | No | Description of what the tool does. |
| `schema` | string | No | JSON stringified schema definition for the tool. |
| `func` | string | No | The function code or definition. |
| `iconSrc` | string | No | URL or path to the tool's icon. |
| `color` | string | No | Color hex code for the tool UI. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Tool updated successfully |
| **400** | Invalid input |
| **404** | Tool not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "description": "Updated description"
}
```

### Response (200)

```json
{
  "id": 1,
  "guid": "tool-guid-12345",
  "name": "My Custom Tool",
  "description": "Updated description",
  "created_on": 1700000000000,
  "last_modified_on": 1700000001000
}
```

---

**DELETE** `/tools/:id`

Delete a tool.
 

## Path Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | string | Yes | The GUID of the tool to delete. |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Tool deleted successfully |
| **404** | Tool not found |
| **500** | Internal server error |

## Examples

### Response (200)

```json
{
  "raw": [],
  "affected": 1
}
```

