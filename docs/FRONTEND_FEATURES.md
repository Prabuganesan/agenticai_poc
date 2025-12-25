# Kodivian Frontend - Features & Architecture

## Table of Contents
1. [Frontend Overview](#frontend-overview)
2. [Technology Stack](#technology-stack)
3. [Application Structure](#application-structure)
4. [Core Features & Views](#core-features--views)
5. [Component Architecture](#component-architecture)
6. [State Management](#state-management)
7. [Routing & Navigation](#routing--navigation)
8. [UI Components Library](#ui-components-library)
9. [Key User Flows](#key-user-flows)
10. [Performance Optimization](#performance-optimization)

---

## Frontend Overview

The Kodivian frontend is a modern, single-page application (SPA) built with React 18.2, providing a visual interface for building, managing, and deploying AI agents and LLM workflows. The UI emphasizes usability, real-time feedback, and seamless integration with the backend services.

### Key Characteristics
- **Framework**: React 18.2 with functional components and hooks
- **Build Tool**: Vite 5.1 for fast development and optimized production builds
- **UI Framework**: Material-UI (MUI) 5.15 for consistent design
- **State Management**: Redux Toolkit 2.2 for global state
- **Canvas Editor**: ReactFlow 11.5 for visual workflow building
- **Code Editing**: CodeMirror 6 for in-app code editing
- **Rich Text**: TipTap 2.11 for formatted text input
- **HTTP Client**: Axios 1.12 with interceptors for API communication

---

## Technology Stack

### Core Dependencies
```json
{
  "react": "18.2.0",
  "react-dom": "18.2.0",
  "react-router-dom": "6.3.0",
  "vite": "5.1.6",
  "@mui/material": "5.15.0",
  "@reduxjs/toolkit": "2.2.7",
  "reactflow": "11.5.6",
  "axios": "1.12.0"
}
```

### UI & Visualization
- **Material-UI (MUI)**: Components, icons, data grid, tree view, lab components
- **Tabler Icons**: 3.30.0+ icon library
- **React Flow**: Visual node-based editor for workflows
- **Recharts**: Chart library for analytics
- **React Markdown**: Markdown rendering with LaTeX support (rehype-mathjax)
- **React Syntax Highlighter**: Code highlighting
- **React Color**: Color picker component

### Code Editing & Rich Text
- **CodeMirror 6**: JavaScript, JSON, Markdown editors
- **TipTap 2.11**: Rich text editor with mentions, placeholders
- **Lowlight 3**: Syntax highlighting for code blocks

### Utilities
- **Formik + Yup**: Form handling and validation
- **Moment.js**: Date manipulation
- **Lodash**: Utility functions
- **UUID**: Unique ID generation
- **DOMPurify**: XSS protection
- **Notistack**: Toast notifications

### Security & Encryption
- **crypto-js**: AES encryption for E2E encryption
- **jsencrypt**: RSA encryption for key exchange
- **simple-crypto-js**: Local storage encryption

---

## Application Structure

### Directory Layout
```
packages/ui/src/
├── api/                  # API client & service functions (35 files)
├── assets/               # Images, icons, SVGs (50+ files)
├── components/           # Reusable React components
├── config.js             # App configuration
├── hooks/                # Custom React hooks (5)
├── index.jsx             # App entry point
├── layout/               # Layout components (17)
│   ├── MainLayout/       # Main app layout with sidebar
│   ├── MinimalLayout/    # Login/minimal layout
│   └── NavigationScroll/ # Scroll behavior
├── menu-items/           # Navigation menu configuration (5)
├── routes/               # React Router configuration (8)
├── store/                # Redux store & reducers (14)
│   ├── actions.js        # Action creators
│   ├── constant.js       # Action constants
│   ├── reducer.jsx       # Root reducer
│   ├── reducers/         # Feature reducers (5)
│   └── context/          # Context providers (5)
├── themes/               # MUI theme configuration (4)
├── ui-component/         # UI components library (106 components)
├── utils/                # Utility functions (10)
│   ├── authUtils.js      # Authentication helpers
│   ├── crypto.js         # E2E encryption utilities
│   └── genericHelper.js  # Generic helpers
└── views/                # Page components (105 files, 22 modules)
    ├── agentexecutions/  # Agent execution history
    ├── agentflows/       # Agent workflow management
    ├── agentflowsv2/     # Enhanced agentflow editor
    ├── apikey/           # API key management
    ├── assistants/       # AI assistants (OpenAI & Custom)
    ├── auth/             # Authentication views
    ├── canvas/           # Visual workflow canvas
    ├── chatbot/          # Chatbot embed preview
    ├── chatflows/        # Chatflow management
    ├── chatmessage/      # Chat message history & viewer
    ├── credentials/      # Credentials management
    ├── docstore/         # Document store (RAG)
    ├── files/            # File manager
    ├── home/             # Dashboard/home page
    ├── llmUsage/         # LLM usage analytics
    ├── marketplaces/     # Component marketplace
    ├── queues/           # Job queue monitor
    ├── serverlogs/       # Server logs viewer
    ├── settings/         # App settings
    ├── tools/            # Tool management
    ├── variables/        # Global variables
    └── vectorstore/      # Vector store operations
```

---

## Core Features & Views

### 1. **Canvas (Visual Workflow Editor)** 📊
**Path**: `/canvas/:id`

The centerpiece of Kodivian - a drag-and-drop visual editor for building AI workflows.

**Components**:
- [CanvasNode.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/CanvasNode.jsx): Individual workflow nodes
- [CanvasHeader.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/CanvasHeader.jsx): Toolbar with save, test, deploy actions
- [AddNodes.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/AddNodes.jsx): Node palette sidebar
- `CanvasContextMenu.jsx`: Right-click context menu
- `ChatflowConfiguration.jsx`: Flow settings panel
- [NodeInputHandler.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/NodeInputHandler.jsx): Dynamic input handling
- [NodeOutputHandler.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/NodeOutputHandler.jsx): Dynamic output handling

**Features**:
- 700+ draggable nodes (chat models, agents, tools, etc.)
- Connection validation & type checking
- Real-time configuration panel
- Multi-select, copy/paste, undo/redo
- Auto-layout and alignment tools
- Zoom, pan, minimap
- Node search and filtering
- Export/import workflows as JSON

**Key Technologies**:
- ReactFlow for canvas rendering
- Redux for state management
- CodeMirror for inline code editing

### 2. **Chatflows Management** 💬
**Path**: `/chatflows`

List, create, and manage chatflow projects.

**Features**:
- Grid/list view of chatflows
- Quick actions (edit, duplicate, delete, export)
- Search and filter
- Tags and categories
- Type badges (CHATFLOW, MULTIAGENT, etc.)
- Analytics preview (usage stats)

**Components**:
- `ChatflowsListTable.jsx`: Data grid with actions
- `SaveChatflowDialog.jsx`: Create/edit dialog
- `ImportChatflowDialog.jsx`: Import from JSON
- `ShareChatbotDialog.jsx`: Embed chatbot

### 3. **Agentflows (Multi-Step Agents)** 🤖
**Path**: `/agentflows`

Create sequential, conditional agent workflows.

**Features**:
- Visual agentflow canvas
- Node types: Start, Agent, Condition, Loop, Tool, Set Variable, End
- Conditional branching (if/else logic)
- Loop support for iterations
- Variable management and state
- Execution history and debugging
- Step-by-step execution tracking

**Components**:
- `AgentflowCanvas.jsx`: Agentflow-specific canvas
- `ConditionNode.jsx`: Conditional logic node
- `LoopNode.jsx`: Loop iteration node
- `ExecutionHistory.jsx`: Execution logs viewer

### 4. **Assistants** 🎓
**Path**: `/assistants`

Manage AI assistants (OpenAI Assistants API and Custom).

**Features**:
- **OpenAI Assistants**:
  - Create assistants with instructions
  - File upload (code interpreter, retrieval)
  - Tools selection (code interpreter, retrieval, functions)
  - Thread management
- **Custom Assistants**:
  - Visual assistant builder
  - Multi-step workflows
  - Custom tools and actions
  - Preview and test interface

**Components**:
- `OpenAIAssistantLayout.jsx`: OpenAI assistant editor
- `CustomAssistantLayout.jsx`: Custom assistant builder
- `CustomAssistantConfigurePreview.jsx`: Live preview

### 5. **Document Store (RAG)** 📚
**Path**: `/docstore`

Document management for Retrieval-Augmented Generation.

**Features**:
- **Document Upload**: Drag-and-drop, file picker
- **Loaders**: 91+ document loaders (PDF, Web, GitHub, etc.)
- **Chunking**: Configure text splitter strategies
- **Vector Stores**: Store and query embeddings
- **Chunk Viewer**: See how documents are split
- **Upsert History**: Track document versions
- **Query Interface**: Search and test retrieval

**Components**:
- `DocumentStoreDetail.jsx`: Document details page
- `ShowStoredChunks.jsx`: Chunk browser
- `LoaderConfigPreviewChunks.jsx`: Preview chunking
- `VectorStoreConfigure.jsx`: Vector store settings
- `VectorStoreQuery.jsx`: Query interface

### 6. **Chat Message Viewer** 💭
**Path**: `/chatmessage`

View and analyze chat conversations.

**Features**:
- Chat session list with filters
- Message history viewer
- Thumbs up/down feedback tracking
- Session metadata (email, phone, custom fields)
- Export conversations
- Message search
- Lead capture data
- Analytics (response time, token usage)

**Components**:
- [ChatMessage.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/chatmessage/ChatMessage.jsx): Main chat viewer
- `SessionList.jsx`: Session browser
- `MessageCard.jsx`: Individual message display
- `FeedbackButton.jsx`: Like/dislike buttons

### 7. **LLM Usage Analytics** 📊
**Path**: `/llmUsage`

Track and analyze LLM usage across all workflows.

**Features**:
- Token usage charts (input/output)
- Cost breakdown by model
- Filter by chatflow, model, date range
- Detailed usage table
- Export reports
- Cost projections
- Model comparison

**Components**:
- `LlmUsageChart.jsx`: Recharts visualizations
- `LlmUsageTable.jsx`: Data grid
- `LlmUsageFilters.jsx`: Filter controls

### 8. **Credentials Management** 🔐
**Path**: `/credentials`

Secure storage for API keys and credentials.

**Features**:
- Add/edit/delete credentials
- Password-type fields (encrypted display)
- Credential templates by provider
- Test credentials
- Usage tracking (which flows use this credential)
- Encrypted storage (AES-256)

**Components**:
- `CredentialListDialog.jsx`: Select credential
- [CredentialInputHandler.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/CredentialInputHandler.jsx): Dynamic credential fields
- `AddEditCredentialDialog.jsx`: Create/edit form

### 9. **API Key Management** 🔑
**Path**: `/apikey`

Generate and manage API keys for chatflow access.

**Features**:
- Create API keys with custom names
- Set per-chatflow access
- Rate limiting configuration
- Regenerate compromised keys
- Usage monitoring
- Expiration dates

**Components**:
- `APIKeyTable.jsx`: Key management grid
- `AddAPIKeyDialog.jsx`: Create key dialog

### 10. **Tools Library** 🛠️
**Path**: `/tools`

Browse and configure 100+ pre-built tools.

**Features**:
- Tool search and filtering
- Category browsing (Web, APIs, Data, Productivity, AI)
- Tool configuration preview
- Custom tool creation
- Tool testing interface
- Usage examples

**Components**:
- `ToolsGrid.jsx`: Grid view of tools
- `ToolCard.jsx`: Individual tool card
- `ToolConfigDialog.jsx`: Configuration modal

### 11. **Marketplaces** 🏪
**Path**: `/marketplaces`

Discover and install community nodes.

**Features**:
- Browse marketplace
- Node preview
- Installation management
- Version control
- Ratings and reviews
- Search and categories

### 12. **Variables** 🔤
**Path**: `/variables`

Manage global variables for workflows.

**Features**:
- Environment-specific variables
- Encrypted storage for sensitive values
- Variable usage tracking
- Bulk import/export

### 13. **Execution History** 📜
**Path**: `/executions`

Track agentflow executions.

**Features**:
- Execution timeline
- Step-by-step logs
- Error tracking
- Performance metrics
- Filter by status, date, flow

### 14. **Queue Monitor** ⚙️
**Path**: `/queues`

Monitor BullMQ job queues.

**Features**:
- Queue overview (pending, active, completed, failed)
- Job details viewer
- Retry failed jobs
- Clear queues
- Real-time updates

### 15. **Server Logs** 📋
**Path**: `/serverlogs`

View server logs in real-time.

**Features**:
- Live log streaming
- Log level filtering (info, warn, error)
- Search logs
- Download logs

---

## Component Architecture

### Layout Components

#### **MainLayout**
The primary layout wrapping all authenticated pages.

**Features**:
- `Sidebar`: Collapsible navigation
- [Header](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/server/src/index.ts#434-451): User menu, notifications, search
- `Breadcrumbs`: Current page path
- `Content Area`: View rendering
- `Customization`: Theme switcher, layout settings

#### **MinimalLayout**
Used for authentication pages (login, register).

**Features**:
- Centered content
- Branding/logo
- No navigation

### Reusable UI Components

**Data Display**:
- `ConfirmDialog.jsx`: Confirmation modals
- `TooltipWithParser.jsx`: Rich tooltips
- `ItemCard.jsx`: Grid item cards
- `Chip`: Status badges
- `TagsInput`: Tagging component

**Forms**:
- `Input.jsx`: Custom input fields
- `Dropdown`: Select components
- `Switch`: Toggle switches
- `DatePicker`: Date selection (react-datepicker)
- `ColorPicker`: Color selection (react-color)

**Code & Editors**:
- `CodeEditor.jsx`: CodeMirror wrapper
- `JSONEditor.jsx`: JSON-specific editor
- `RichTextEditor.jsx`: TipTap wrapper

**Node Components**:
- [NodeInputHandler.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/NodeInputHandler.jsx): Dynamic node inputs
- [NodeOutputHandler.jsx](file:///Users/kodivian/MyWorks/GitlabClone/agentserver/Newkodivian/agenticai/app_v17_builder/inputs/kodivian/packages/ui/src/views/canvas/NodeOutputHandler.jsx): Dynamic node outputs
- `NodeTooltip.jsx`: Node documentation tooltips

**Dialogs & Modals**:
- `AddEditNodeDialog.jsx`: Node configuration
- `AnalyseFlowDialog.jsx`: Flow analysis modal
- `ShareChatbotDialog.jsx`: Embed code generator
- `VariableDialog.jsx`: Variable selector

**Loading & Empty States**:
- `Loadable.jsx`: Lazy loading wrapper
- `ViewHeader.jsx`: Page headers
- `EmptyView.jsx`: No data placeholder
- `SkeletonLoader.jsx`: Skeleton screens

---

## State Management

### Redux Store Structure

**Store Setup**: `@reduxjs/toolkit` with slice pattern

**Reducers**:
```javascript
{
  canvas: canvasReducer,        // Canvas state (nodes, edges)
  customization: customReducer, // UI customization (theme, layout)
  notifier: notifierReducer,    // Toast notifications
  dialog: dialogReducer,        // Modal state
  chatflow: chatflowReducer     // Chatflow metadata
}
```

### Redux Slices

#### **Canvas Reducer**
Manages visual workflow canvas state.

**State**:
- `nodes[]`: Workflow nodes
- `edges[]`: Connections between nodes
- `selectedNode`: Currently selected node
- `componentNodes[]`: Available component nodes
- `canvasDataStore`: Canvas metadata

**Actions**:
- `SET_NODES`: Update nodes
- `SET_EDGES`: Update edges
- `ADD_NODE`: Add new node
- `DELETE_NODE`: Remove node
- `CLONE_NODES`: Duplicate nodes
- `SET_DIRTY`: Mark canvas as modified

#### **Customization Reducer**
UI theme and layout preferences.

**State**:
- `isOpen[]`: Sidebar/menu open state
- `opened`: Default menu state
- `theme`: Current theme (light/dark)
- `borderRadius`: UI border radius
- `fontFamily`: Font selection

**Actions**:
- `MENU_OPEN`: Toggle menu
- `SET_MENU`: Menu state
- `SET_FONT_FAMILY`: Change font
- `SET_BORDER_RADIUS`: Update border radius

#### **Notifier Reducer**
Toast notification state.

**Actions**:
- `ENQUEUE_SNACKBAR`: Show notification
- `CLOSE_SNACKBAR`: Hide notification
- `REMOVE_SNACKBAR`: Remove from queue

#### **Dialog Reducer**
Manages modal dialog state.

**State**:
- `isOpen`: Dialog visibility
- `dialogProps`: Dialog configuration

**Actions**:
- `SHOW_DIALOG`: Open dialog
- `HIDE_DIALOG`: Close dialog

---

## Routing & Navigation

### Route Configuration

**Public Routes** (MinimalLayout):
- `/login`: Login page

**Protected Routes** (MainLayout + RequireAuth):
- `/home`: Dashboard
- `/chatflows`: Chatflow list
- `/agentflows`: Agentflow list
- `/canvas/:id`: Canvas editor
- `/assistants`: Assistants management
- `/credentials`: Credentials vault
- `/docstore`: Document store
- `/llmUsage`: Usage analytics
- `/apikey`: API key management
- `/tools`: Tools library
- `/marketplaces`: Marketplace
- `/variables`: Variables
- `/executions`: Execution history
- `/queues`: Queue monitor
- `/serverlogs`: Server logs
- `/settings`: App settings

### Navigation Menu Structure

**Menu Items**:
```javascript
{
  chatflows: { icon: MessageIcon, path: '/chatflows' },
  agentflows: { icon: AccountTreeIcon, path: '/agentflows' },
  assistants: { icon: AssistantIcon, path: '/assistants' },
  marketplaces: { icon: ShoppingCartIcon, path: '/marketplaces' },
  tools: { icon: BuildIcon, path: '/tools' },
  credentials: { icon: LockIcon, path: '/credentials' },
  variables: { icon: CodeIcon, path: '/variables' },
  docstore: { icon: DescriptionIcon, path: '/docstore' },
  apikey: { icon: KeyIcon, path: '/apikey' },
  llmUsage: { icon: BarChartIcon, path: '/llmUsage' },
  executions: { icon: HistoryIcon, path: '/executions' },
  queues: { icon: QueueIcon, path: '/queues' },
  serverlogs: { icon: TextSnippetIcon, path: '/serverlogs' }
}
```

### Permission-Based Routing

Routes protected with `<RequireAuth>` component:
```javascript
<RequireAuth permission={'chatflows:view'}>
  <Chatflows />
</RequireAuth>
```

**Permissions**:
- `chatflows:view`, `chatflows:create`, `chatflows:update`, `chatflows:delete`
- `agentflows:view`, `agentflows:create`, etc.
- Similar patterns for all resources

---

## UI Components Library

### Material-UI Components Used

**Layout**:
- `Box`, `Container`, `Grid`, `Stack`
- `AppBar`, `Toolbar`, `Divider`
- `Drawer`, `Paper`, `Card`

**Navigation**:
- `Menu`, `MenuItem`, `MenuList`
- `Tabs`, `Tab`
- `Breadcrumbs`, `Link`

**Inputs**:
- `TextField`, `Select`, `Autocomplete`
- `Button`, `IconButton`, `ToggleButton`
- `Checkbox`, `Radio`, `Switch`
- `Slider`, `Rating`

**Data Display**:
- `DataGrid` (MUI X Data Grid)
- `TreeView` (MUI X Tree View)
- `Table`, `TableRow`, `TableCell`
- `Chip`, `Avatar`, `Badge`
- `Tooltip`, `Popover`, `Dialog`

**Feedback**:
- `Alert`, `Snackbar`
- `CircularProgress`, `LinearProgress`
- `Backdrop`, `Skeleton`

**Icons**:
- `@mui/icons-material`: 2000+ icons
- `@tabler/icons-react`: Additional icons

### Custom Component Patterns

**Lazy Loading**:
```javascript
const Component = Loadable(lazy(() => import('./Component')))
```

**Dialog Wrapper**:
```javascript
<ConfirmDialog
  open={open}
  onConfirm={handleConfirm}
  onCancel={handleCancel}
  title="Are you sure?"
/>
```

**Form Handling**:
```javascript
<Formik
  initialValues={...}
  validationSchema={yupSchema}
  onSubmit={handleSubmit}
>
  {({ values, errors }) => <Form>...</Form>}
</Formik>
```

---

## Key User Flows

### 1. **Create Chatflow**
1. Click "Add New Chatflow" button
2. Enter name, description, tags
3. Select type (Chatflow, Agentflow, Multiagent)
4. Click "Add" → Navigate to Canvas
5. Drag nodes from palette
6. Connect nodes
7. Configure each node
8. Save and test

### 2. **Build RAG Application**
1. Navigate to Document Store
2. Create new document store
3. Upload documents (PDF, Web, etc.)
4. Configure text splitter
5. Select vector store
6. Configure embeddings model
7. Upsert documents
8. Go to Canvas
9. Add retrieval chain/agent
10. Connect to document store
11. Test and deploy

### 3. **Manage API Keys**
1. Navigate to API Keys
2. Click "Add New API Key"
3. Enter key name
4. Select chatflows
5. Set rate limits
6. Generate key
7. Copy and use in external apps

### 4. **Monitor LLM Usage**
1. Navigate to LLM Usage
2. Select date range
3. Filter by chatflow/model
4. View token usage charts
5. Analyze costs
6. Export report

### 5. **Deploy Chatbot**
1. Open chatflow
2. Click "Share Chatbot"
3. Configure embed options (theme, position)
4. Copy embed code
5. Paste into website

---

## Performance Optimization

### Implemented Optimizations

**Code Splitting**:
- Lazy loading for all views
- Dynamic imports for heavy components
- Route-based code splitting

**Memoization**:
- `React.memo` for expensive components
- `useMemo` for computed values
- `useCallback` for stable function references

**Virtualization**:
- Virtual scrolling for large lists
- Lazy rendering for canvas nodes

**Caching**:
- API response caching (Axios)
- Local storage for preferences
- Redux state persistence

**Asset Optimization**:
- Image lazy loading
- SVG icon sprites
- Tree-shaking for unused code
- Minification and compression (Vite)

**Bundle Optimization**:
- Code splitting: ~5.4MB main bundle → chunks
- Gzip compression: 1.77MB gzipped
- Lazy loading reduces initial load ~60%

---

## Build & Deployment

### Development
```bash
pnpm dev  # Vite dev server (hot reload)
```

### Production Build
```bash
pnpm build  # Output: build/ directory
```

**Build Stats**:
- Main bundle: ~5.4MB (uncompressed)
- Gzipped: ~1.77MB
- Asset types: JS, CSS, images, fonts
- Build time: ~40-60s

### Environment Configuration

**Development** (`.env`):
```bash
VITE_PORT=8080
VITE_BASE_PATH=/kodivian
```

**Production**:
- Static files served from `build/`
- Context path: `/kodivian`
- Base URL configured via server

---

## Accessibility & UX

### Accessibility Features
- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Screen reader compatible
- Color contrast compliance

### UX Enhancements
- Toast notifications for feedback
- Loading states and skeletons
- Error boundaries for graceful failures
- Responsive design (mobile-friendly)
- Dark mode support
- Customizable theme

---

## Future Enhancements

### Planned Features
- Real-time collaboration (multi-user canvas)
- Version control for workflows
- Advanced debugging tools
- Performance profiling dashboard
- A/B testing for chatflows
- Custom theme builder
- Mobile app (React Native)

---

**Last Updated**: 2025-11-29  
**Frontend Version**: 3.0.10  
**Documentation Version**: 1.0
