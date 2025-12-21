import express from 'express'
import path from 'path'
import fs from 'fs'

// Resolve path to kodivianDocs directory
const getDocsPath = () => {
    // for prod
    if (process.env.KODIVIAN_DATA_PATH) {
        const docsPath = path.join(process.env.KODIVIAN_DATA_PATH, 'kodivianDocs')
        if (fs.existsSync(docsPath)) {
            return docsPath
        }
    }

    // for development
    const docsPathDev = path.join(__dirname, '..', '..', '..', '..', '..', 'kodivianDocs')
    if (fs.existsSync(docsPathDev)) {
        return docsPathDev
    }

    console.warn('⚠️ [Docs]: kodivianDocs directory not found. Documentation will not be available.')
    return null
}

const docsPath = getDocsPath()

// Preprocess GitBook-specific markdown syntax
function preprocessGitBookSyntax(markdown: string): string {
    let processed = markdown

    // Handle {% hint style="..." %} blocks
    // Convert to styled div blocks
    processed = processed.replace(/{% hint style="(info|warning|danger|success)" %}([\s\S]*?){% endhint %}/g, (match, style, content) => {
        const styles: Record<string, { bg: string; border: string; color: string; icon: string }> = {
            info: { bg: '#eff6ff', border: '#3b82f6', color: '#1e40af', icon: '💡' },
            warning: { bg: '#fef3c7', border: '#f59e0b', color: '#92400e', icon: '⚠️' },
            danger: { bg: '#fee2e2', border: '#ef4444', color: '#991b1b', icon: '🚨' },
            success: { bg: '#d1fae5', border: '#10b981', color: '#065f46', icon: '✅' }
        }
        const styleConfig = styles[style] || styles.info
        const htmlContent = content
            .trim()
            .split('\n')
            .map((line: string) => line.trim())
            .join('<br>')

        return `\n<div style="background: ${styleConfig.bg}; border-left: 4px solid ${styleConfig.border}; color: ${styleConfig.color
            }; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
<strong style="display: block; margin-bottom: 8px; font-size: 14px;">${styleConfig.icon} ${style.toUpperCase()}</strong>
${htmlContent}
</div>\n`
    })

    // Handle {% openapi-operation %} blocks
    processed = processed.replace(
        /{% openapi-operation spec="([^"]*)" path="([^"]*)" method="([^"]*)" %}([\s\S]*?){% endopenapi-operation %}/g,
        (match, spec, path, method) => {
            return `\n<div style="background: #f8fafc; border-left: 4px solid #64748b; padding: 16px 20px; border-radius: 8px; margin: 24px 0;">
<strong>API Endpoint:</strong> <code>${method.toUpperCase()} ${path}</code><br>
See API documentation for details.
</div>\n`
        }
    )

    // Handle {% embed url="..." %} blocks
    processed = processed.replace(/{% embed url="([^"]*)" %}([\s\S]*?){% endembed %}/g, (match, url) => {
        return `\n[Embedded content: ${url}](${url})\n`
    })

    // Handle {% code %} blocks with titles
    processed = processed.replace(/{% code title="([^"]*)" %}([\s\S]*?){% endcode %}/g, (match, title, content) => {
        return `\n**${title}**\n\`\`\`\n${content.trim()}\n\`\`\`\n`
    })

    // Handle {% tabs %} and {% tab %} blocks
    processed = processed.replace(/{% tabs %}/g, '\n')
    processed = processed.replace(/{% tab title="([^"]*)" %}/g, '\n#### $1\n')
    processed = processed.replace(/{% endtab %}/g, '\n')
    processed = processed.replace(/{% endtabs %}/g, '\n')

    // Handle {% content-ref url="..." %} blocks
    processed = processed.replace(/{% content-ref url="([^"]*)" %}([\s\S]*?){% endcontent-ref %}/g, (match, url) => {
        return `\n📄 [See: ${url}](${url})\n`
    })

    return processed
}

const apiRouter = express.Router()
const staticRouter = express.Router()

// POST /convertMdtohtml - Convert markdown file to HTML
apiRouter.post('/convertMdtohtml', async (req, res) => {
    try {
        const { path: mdPath } = req.body
        if (!mdPath || typeof mdPath !== 'string') {
            return res.status(400).json({ error: 'Invalid path parameter' })
        }

        // Security: prevent path traversal attacks
        const normalizedPath = path.normalize(mdPath).replace(/^(\.\.(\/|\\|$))+/, '')
        if (!docsPath) {
            return res.status(404).json({ error: 'Documentation not found' })
        }

        const fullPath = path.join(docsPath, normalizedPath)

        // Ensure the file is within the docs directory
        if (!fullPath.startsWith(docsPath)) {
            return res.status(403).json({ error: 'Access denied' })
        }

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        // Read markdown file
        let markdown = fs.readFileSync(fullPath, 'utf-8')

        // Extract and remove YAML frontmatter
        let frontmatter: Record<string, any> = {}
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/
        const frontmatterMatch = markdown.match(frontmatterRegex)

        if (frontmatterMatch) {
            // Parse YAML frontmatter (simple key-value parsing)
            const yamlContent = frontmatterMatch[1]
            const lines = yamlContent.split('\n')
            lines.forEach((line) => {
                const match = line.match(/^(\w+):\s*(.+)$/)
                if (match) {
                    frontmatter[match[1]] = match[2].trim()
                }
            })

            // Remove frontmatter from markdown
            markdown = markdown.replace(frontmatterRegex, '')
        }

        // Preprocess GitBook-specific syntax
        markdown = preprocessGitBookSyntax(markdown)

        // Convert to HTML using marked
        const markedModule = await import('marked')
        // Handle both default export (common in some setups) and named export
        const marked = markedModule.marked || (markedModule as any).default

        if (!marked) {
            throw new Error('Failed to load marked library')
        }

        let html = await marked.parse(markdown)

        // Fix relative image paths
        // The base directory of the markdown file
        const mdDir = path.dirname(normalizedPath)

        // Replace image src attributes
        html = html.replace(/src="([^"]+)"/g, (match: string, src: string) => {
            // Skip absolute URLs
            if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
                return match
            }

            // Resolve relative path from markdown file location
            const resolvedPath = path.join(mdDir, src).replace(/\\/g, '/')
            const apiContextPath = process.env.CONTEXT_PATH || '/kodivian'
            return `src="${apiContextPath}/docs/${resolvedPath}"`
        })

        // Replace srcset attributes for responsive images
        html = html.replace(/srcset="([^"]+)"/g, (match: string, srcset: string) => {
            const sources = srcset.split(',').map((source: string) => {
                const parts = source.trim().split(' ')
                const src = parts[0]

                // Skip absolute URLs
                if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
                    return source
                }

                // Resolve relative path
                const resolvedPath = path.join(mdDir, src).replace(/\\/g, '/')
                const apiContextPath = process.env.CONTEXT_PATH || '/kodivian'
                parts[0] = `${apiContextPath}/docs/${resolvedPath}`
                return parts.join(' ')
            })
            return `srcset="${sources.join(', ')}"`
        })

        res.send(html)
    } catch (error) {
        console.error('Error converting markdown:', error)
        res.status(500).json({ error: 'Failed to convert markdown' })
    }
})

// Serve static files from the docs directory
if (docsPath) {
    // express.static will automatically serve index.html for root path
    staticRouter.use('/', express.static(docsPath))

    // SPA Fallback: Serve index.html for any other GET request
    staticRouter.get('*', (req, res) => {
        res.sendFile(path.join(docsPath, 'index.html'))
    })
} else {
    staticRouter.use('*', (req, res) => {
        res.status(404).send('Documentation not found (kodivianDocs directory missing)')
    })
}

export { apiRouter as docsApiRouter, staticRouter as docsStaticRouter }
export default apiRouter
