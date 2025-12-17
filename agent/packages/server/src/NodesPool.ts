import { IComponentNodes, IComponentCredentials } from './Interface'
import path from 'path'
import { Dirent } from 'fs'
import { getNodeModulesPackagePath } from './utils'
import { promises } from 'fs'
import { ICommonObject } from 'autonomous-components'
import { logError } from './utils/logger/system-helper'
import { appConfig } from './AppConfig'

export class NodesPool {
    componentNodes: IComponentNodes = {}
    componentCredentials: IComponentCredentials = {}
    private credentialIconPath: ICommonObject = {}

    /**
     * Initialize to get all nodes & credentials
     */
    async initialize() {
        await this.initializeNodes()
        await this.initializeCredentials()
    }

    /**
     * Initialize nodes
     */
    private async initializeNodes() {
        const disabled_nodes = process.env.DISABLED_NODES ? process.env.DISABLED_NODES.split(',') : []
        const packagePath = getNodeModulesPackagePath('autonomous-components')
        const nodesPath = path.join(packagePath, 'dist', 'components', 'nodes')
        const nodeFiles = await this.getFiles(nodesPath)
        return Promise.all(
            nodeFiles.map(async (file) => {
                // Skip LlamaIndex files (removed from codebase)
                if (file.includes('LlamaIndex')) {
                    return
                }
                if (file.endsWith('.js')) {
                    try {
                        const nodeModule = await require(file)

                        if (nodeModule.nodeClass) {
                            const newNodeInstance = new nodeModule.nodeClass()
                            newNodeInstance.filePath = file

                            // Replace file icon with absolute path
                            if (
                                newNodeInstance.icon &&
                                (newNodeInstance.icon.endsWith('.svg') ||
                                    newNodeInstance.icon.endsWith('.png') ||
                                    newNodeInstance.icon.endsWith('.jpg'))
                            ) {
                                const filePath = file.replace(/\\/g, '/').split('/')
                                filePath.pop()
                                let nodeIconAbsolutePath = `${filePath.join('/')}/${newNodeInstance.icon}`
                                // Icons are in dist/nodes but node files are in dist/components/nodes
                                // Replace dist/components/nodes with dist/nodes in the icon path
                                nodeIconAbsolutePath = nodeIconAbsolutePath.replace(/dist\/components\/nodes\//g, 'dist/nodes/')
                                newNodeInstance.icon = nodeIconAbsolutePath

                                // Store icon path for componentCredentials
                                if (newNodeInstance.credential) {
                                    for (const credName of newNodeInstance.credential.credentialNames) {
                                        this.credentialIconPath[credName] = nodeIconAbsolutePath
                                    }
                                }
                            }

                            const skipCategories = ['Analytic', 'SpeechToText']
                            const conditionOne = !skipCategories.includes(newNodeInstance.category)

                            const isCommunityNodesAllowed = appConfig.showCommunityNodes
                            const isAuthorPresent = newNodeInstance.author
                            let conditionTwo = true
                            if (!isCommunityNodesAllowed && isAuthorPresent) conditionTwo = false

                            const isDisabled = disabled_nodes.includes(newNodeInstance.name)

                            if (conditionOne && conditionTwo && !isDisabled) {
                                this.componentNodes[newNodeInstance.name] = newNodeInstance
                            }
                        }
                    } catch (err: any) {
                        logError(`❌ [server]: Error during initDatabase with file ${file}:`, err).catch(() => {})
                    }
                }
            })
        )
    }

    /**
     * Initialize credentials
     */
    private async initializeCredentials() {
        const packagePath = getNodeModulesPackagePath('autonomous-components')
        const nodesPath = path.join(packagePath, 'dist', 'components', 'credentials')
        const nodeFiles = await this.getFiles(nodesPath)
        return Promise.all(
            nodeFiles.map(async (file) => {
                if (file.endsWith('.credential.js')) {
                    try {
                        const credentialModule = await require(file)
                        if (credentialModule.credClass) {
                            const newCredInstance = new credentialModule.credClass()
                            newCredInstance.icon = this.credentialIconPath[newCredInstance.name] ?? ''
                            this.componentCredentials[newCredInstance.name] = newCredInstance
                        }
                    } catch (err: any) {
                        logError(`❌ [server]: Error during initCredentials with file ${file}:`, err).catch(() => {})
                    }
                }
            })
        )
    }

    /**
     * Recursive function to get node files
     * @param {string} dir
     * @returns {string[]}
     */
    private async getFiles(dir: string): Promise<string[]> {
        const dirents = await promises.readdir(dir, { withFileTypes: true })
        const files = await Promise.all(
            dirents.map((dirent: Dirent) => {
                const res = path.resolve(dir, dirent.name)
                return dirent.isDirectory() ? this.getFiles(res) : res
            })
        )
        return Array.prototype.concat(...files)
    }
}
