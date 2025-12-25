# Kodivian Document Loaders Reference Guide

A comprehensive guide to all document loaders in the Kodivian platform. Document loaders extract content from various file formats and sources for use in RAG applications.

---

## What are Document Loaders?

**Document Loaders** extract text content from files, websites, and external services to create documents for vector storage and retrieval.

### How Document Loaders Work

```
Source (PDF, Website, Database)
         ↓
Document Loader: Extract content
         ↓
Documents: [{content, metadata}]
         ↓
Text Splitter: Chunk content
         ↓
Embeddings: Convert to vectors
         ↓
Vector Store: Store for retrieval
```

---

## Quick Decision Matrix

| Category | Loaders | Use Case |
|----------|---------|----------|
| **Office Docs** | PDF, Word, Excel, PowerPoint | Business documents |
| **Web Content** | Cheerio, Playwright, Puppeteer, FireCrawl | Web scraping |
| **Cloud Storage** | S3, Google Drive | File storage |
| **Productivity Apps** | Notion, Confluence, Airtable, Google Sheets | Team content |
| **Dev & Code** | GitHub, Gitbook, JSON, CSV | Technical docs |
| **Custom** | API, Custom Loader | Any source |

---

# Office Documents

## 1. PDF Loader
Extract text from PDF files.

| Setting | Description |
|---------|-------------|
| PDF File | Upload PDF |
| Usage | Per Page / Per File |
| Legacy Build | Use pdfjs-dist (legacy) |

**Output**: One document per page or entire file

---

## 2. Microsoft Word (Docx)
Extract text from Word documents.

| Setting | Description |
|---------|-------------|
| Docx File | Upload .docx file |

---

## 3. Microsoft Excel
Extract data from Excel spreadsheets.

| Setting | Description |
|---------|-------------|
| Excel File | Upload .xlsx file |
| Sheet Name | Specific sheet (optional) |

**Output**: Rows as documents with column metadata

---

## 4. Microsoft PowerPoint
Extract text from presentations.

| Setting | Description |
|---------|-------------|
| PowerPoint File | Upload .pptx file |

**Output**: Text from all slides

---

## 5. EPUB
Extract text from e-books.

| Setting | Description |
|---------|-------------|
| EPUB File | Upload .epub file |

---

## 6. Plain Text / Text File
Load plain text files.

| Setting | Description |
|---------|-------------|
| Text File | Upload .txt file |

---

# Web Content Loaders

## 7. Cheerio Web Scraper
Fast HTML parsing (no JavaScript).

| Setting | Description |
|---------|-------------|
| URL | Web page URL |
| Selector | CSS selector (optional) |
| Get Relative Links | Follow links |
| Max Links | Limit followed links |

**Best For**: Static websites, fast scraping

---

## 8. Playwright Web Scraper
Full browser rendering with JavaScript.

| Setting | Description |
|---------|-------------|
| URL | Web page URL |
| Selector | Wait for selector |
| Wait Time | Wait before capture (ms) |

**Best For**: JavaScript-heavy sites, SPAs

---

## 9. Puppeteer Web Scraper
Chrome headless browser scraping.

| Setting | Description |
|---------|-------------|
| URL | Web page URL |
| Selector | Wait for selector |

**Best For**: Complex JavaScript sites

---

## 10. FireCrawl
AI-powered web scraping service.

| Setting | Description |
|---------|-------------|
| Credential | `fireCrawlApi` |
| URL | Starting URL |
| Crawl Type | crawl / scrape |
| Max Pages | Limit crawled pages |

**Features**:
- Handles dynamic content
- Respects robots.txt
- Clean markdown output

**Best For**: Quality web content extraction

---

## 11. Apify Website Crawler
Professional web scraping platform.

| Setting | Description |
|---------|-------------|
| Credential | `apifyApi` |
| Start URLs | URLs to crawl |
| Max Pages | Crawler limit |

**Best For**: Large-scale crawling

---

## 12. Spider Loader
Kodivian crawl and scrape service.

| Setting | Description |
|---------|-------------|
| Credential | `spiderApi` |
| URL | Starting URL |
| Mode | crawl / scrape |

---

## 13. Oxylabs Loader
Proxy-based web scraping.

| Setting | Description |
|---------|-------------|
| Credential | `oxylabsApi` |
| URL | Target URL |

**Best For**: Bypassing blocks, geo-restricted content

---

# Search & API Loaders

## 14. SearchAPI Loader
Load web search results.

| Setting | Description |
|---------|-------------|
| Credential | `searchApi` |
| Query | Search query |
| Engine | google, bing, etc. |

---

## 15. SerpAPI Loader
Google search results via SerpAPI.

| Setting | Description |
|---------|-------------|
| Credential | `serpApi` |
| Query | Search query |

---

## 16. Brave Search Loader
Privacy-focused search results.

| Setting | Description |
|---------|-------------|
| Credential | `braveSearchApi` |
| Query | Search query |

---

## 17. API Loader
Load data from any REST API.

| Setting | Description |
|---------|-------------|
| Method | GET / POST |
| URL | API endpoint |
| Headers | Request headers (JSON) |
| Body | Request body (JSON) |

**Best For**: Custom API integrations

---

# Cloud Storage

## 18. AWS S3 File
Load single file from S3.

| Setting | Description |
|---------|-------------|
| Credential | `awsApi` |
| Bucket | S3 bucket name |
| Key | File path/key |
| Region | AWS region |

---

## 19. AWS S3 Directory
Load all files from S3 prefix.

| Setting | Description |
|---------|-------------|
| Credential | `awsApi` |
| Bucket | S3 bucket name |
| Prefix | Folder prefix |
| Region | AWS region |

---

## 20. Google Drive
Load files from Google Drive.

| Setting | Description |
|---------|-------------|
| Credential | `googleDriveOAuth2` |
| File ID / Folder ID | Target resource |

---

# Productivity Apps

## 21. Notion Loader
Extract content from Notion pages.

| Setting | Description |
|---------|-------------|
| Credential | `notionApi` |
| Page ID / Database ID | Target resource |
| Type | page / database |

**Features**:
- Pages and databases
- Nested content
- Rich text extraction

---

## 22. Confluence Loader
Load Atlassian Confluence pages.

| Setting | Description |
|---------|-------------|
| Credential | `confluenceApi` |
| Base URL | Confluence URL |
| Space Key | Target space |

---

## 23. Airtable Loader
Load records from Airtable.

| Setting | Description |
|---------|-------------|
| Credential | `airtableApi` |
| Base ID | Airtable base |
| Table ID | Target table |

---

## 24. Google Sheets Loader
Load spreadsheet data.

| Setting | Description |
|---------|-------------|
| Credential | `googleSheetsOAuth2` |
| Spreadsheet ID | Target sheet |
| Sheet Name | Specific sheet |

---

## 25. Jira Loader
Load Jira issues.

| Setting | Description |
|---------|-------------|
| Credential | `jiraApi` |
| Base URL | Jira instance |
| Query | JQL filter |

---

## 26. Figma Loader
Extract content from Figma designs.

| Setting | Description |
|---------|-------------|
| Credential | `figmaApi` |
| File Key | Figma file ID |

---

# Developer & Code

## 27. GitHub Loader
Load files from GitHub repos.

| Setting | Description |
|---------|-------------|
| Credential | `githubApi` (PAT) |
| Repository | owner/repo |
| Branch | Target branch |
| Path | File/folder path |
| Recursive | Include subdirs |

**Best For**: Code documentation, README files

---

## 28. Gitbook Loader
Load Gitbook documentation.

| Setting | Description |
|---------|-------------|
| URL | Gitbook URL |

---

## 29. JSON Loader
Extract content from JSON files.

| Setting | Description |
|---------|-------------|
| JSON File | Upload JSON |
| JSONPath | Extract path (optional) |

---

## 30. JSON Lines Loader
Load JSONL format files.

| Setting | Description |
|---------|-------------|
| JSONL File | Upload .jsonl |

---

## 31. CSV Loader
Load CSV files as documents.

| Setting | Description |
|---------|-------------|
| CSV File | Upload CSV |
| Column | Text column to load |

---

# Advanced Loaders

## 32. Unstructured Loader
AI-powered document parsing.

| Setting | Description |
|---------|-------------|
| Credential | `unstructuredApi` |
| File | Any document type |
| Strategy | fast / hi_res / ocr_only |

**Supported Formats**: PDF, Word, Excel, Images, HTML, and 20+ more

**Best For**: Complex documents, tables, images with text

---

## 33. Folder Loader
Load all files from a directory.

| Setting | Description |
|---------|-------------|
| Folder Path | Local folder path |
| Recursive | Include subfolders |

---

## 34. File Loader
Load any single file.

| Setting | Description |
|---------|-------------|
| File | Upload any file |

---

## 35. Vector Store to Document
Convert vector store entries back to documents.

| Setting | Description |
|---------|-------------|
| Vector Store | Source vector store |
| Query | Filter query |

---

## 36. Document Store Loader
Load from internal document store.

| Setting | Description |
|---------|-------------|
| (Automatic) | Uses built-in storage |

---

## 37. Custom Document Loader
Build your own loader with JavaScript.

| Setting | Description |
|---------|-------------|
| JavaScript Code | Loader implementation |

**Example**:
```javascript
const docs = [];
const response = await fetch('https://api.example.com/data');
const data = await response.json();
for (const item of data) {
  docs.push({
    pageContent: item.content,
    metadata: { source: item.url }
  });
}
return docs;
```

---

# Feature Comparison

| Loader | Auth | Pagination | Metadata |
|--------|------|------------|----------|
| **PDF** | ❌ | Per page | filename, page |
| **Cheerio** | ❌ | ❌ | url |
| **Playwright** | ❌ | ❌ | url |
| **GitHub** | Token | ✅ | path, repo |
| **Notion** | API Key | ✅ | page_id, title |
| **S3** | AWS | ❌ | bucket, key |
| **Unstructured** | API Key | ❌ | type, coords |

---

# Best Practices

## 1. Choosing a Web Loader

| Need | Recommendation |
|------|----------------|
| Static HTML | Cheerio (fastest) |
| JavaScript sites | Playwright or Puppeteer |
| Quality extraction | FireCrawl |
| Large scale | Apify |

## 2. Office Documents

| Format | Loader |
|--------|--------|
| PDF | PDF Loader |
| Word (.docx) | Docx Loader |
| Excel (.xlsx) | Excel Loader |
| Multiple formats | Unstructured |

## 3. Metadata Enrichment

- Always preserve source metadata
- Add custom metadata for filtering
- Include timestamps for freshness

## 4. Integration Flow

```mermaid
flowchart LR
    A[Source] --> B[Document Loader]
    B --> C[Raw Documents]
    C --> D[Text Splitter]
    D --> E[Chunks]
    E --> F[Embedding Model]
    F --> G[Vector Store]
```
