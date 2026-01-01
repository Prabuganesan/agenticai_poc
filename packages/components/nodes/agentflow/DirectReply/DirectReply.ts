import { get } from 'lodash'
import { ICommonObject, INode, INodeData, INodeParams, IServerSideEventStreamer } from '../../../src/Interface'

class DirectReply_Agentflow implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    color: string
    hideOutput: boolean
    hint: string
    baseClasses: string[]
    documentation?: string
    credential: INodeParams
    inputs: INodeParams[]

    constructor() {
        this.label = 'Direct Reply'
        this.name = 'directReplyAgentflow'
        this.version = 1.0
        this.type = 'DirectReply'
        this.category = 'Agent Flows'
        this.description = 'Directly reply to the user with a message'
        this.baseClasses = [this.type]
        this.color = '#4DDBBB'
        this.hideOutput = true
        this.inputs = [
            {
                label: 'Message',
                name: 'directReplyMessage',
                type: 'string',
                rows: 4,
                acceptVariable: true
            }
        ]
    }

    async run(nodeData: INodeData, _: string, options: ICommonObject): Promise<any> {
        let directReplyMessage = nodeData.inputs?.directReplyMessage as string

        const state = options.agentflowRuntime?.state as ICommonObject
        const chatId = options.chatId as string
        const isLastNode = options.isLastNode as boolean
        const isStreamable = isLastNode && options.sseStreamer !== undefined

        // Resolve Variables
        if (directReplyMessage && state) {


            // Looser regex to capture any {{ variable }} content
            directReplyMessage = directReplyMessage.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, variable) => {
                const cleanVar = variable.trim();
                if (cleanVar.startsWith('$flow.state.')) {
                    const path = cleanVar.replace('$flow.state.', '');
                    const value = get(state, path);


                    if (value !== undefined && value !== null) {
                        return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
                    }
                }

                // If we can't resolve it, leave it alone (or maybe strictly $flow.state was expected but not found)
                return match;
            });


        }

        if (isStreamable) {
            const sseStreamer: IServerSideEventStreamer = options.sseStreamer
            sseStreamer.streamTokenEvent(chatId, directReplyMessage)
        }

        const returnOutput = {
            id: nodeData.id,
            name: this.name,
            input: {},
            output: {
                content: directReplyMessage
            },
            state
        }

        return returnOutput
    }
}

module.exports = { nodeClass: DirectReply_Agentflow }
