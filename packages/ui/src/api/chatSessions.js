import client from './client'

// Create a new chat session
const createChatSession = (chatflowId, title) =>
    client.post('/chat-sessions/create', {
        chatflowId,
        title: title || 'New Chat'
    })

// Get all chat sessions for a chatflow
const listChatSessions = (chatflowId, page = 1, limit = 50) =>
    client.post('/chat-sessions/list', {
        chatflowId,
        page,
        limit
    })

// Get a specific chat session by chatId
const getChatSession = (chatId) =>
    client.post('/chat-sessions/get', {
        chatId
    })

// Update a chat session (title, preview, messageCount)
const updateChatSession = (chatId, updates) =>
    client.post('/chat-sessions/update', {
        chatId,
        ...updates
    })

// Delete a chat session
const deleteChatSession = (chatId) =>
    client.post('/chat-sessions/delete', {
        chatId
    })

export default {
    createChatSession,
    listChatSessions,
    getChatSession,
    updateChatSession,
    deleteChatSession
}

