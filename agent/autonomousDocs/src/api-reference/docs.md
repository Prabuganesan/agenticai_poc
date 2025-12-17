# Docs

**POST** `/docs/convertMdtohtml`

Convert a markdown file to HTML. This endpoint is used by the documentation viewer to render markdown content.

## Body Parameters

| Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `path` | string | Yes | The relative path to the markdown file within the documentation directory.<br>_Example: "src/api-reference/docs.md"_ |

## Responses

| Status | Description |
| :--- | :--- |
| **200** | Markdown converted to HTML successfully |
| **400** | Invalid input (missing path) |
| **403** | Access denied (path traversal attempt) |
| **404** | File not found |
| **500** | Internal server error |

## Examples

### Request

```json
{
  "path": "src/api-reference/docs.md"
}
```

### Response (200)

```html
<h1>Docs</h1>
<p>API documentation for Docs.</p>
```
