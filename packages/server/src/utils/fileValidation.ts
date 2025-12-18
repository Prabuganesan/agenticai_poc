import { InternalAutonomousError } from '../errors/internalAutonomousError'
import { StatusCodes } from 'http-status-codes'

const FILE_SIGNATURES: Record<string, Buffer[]> = {
    'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
    'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
    'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    'image/gif': [Buffer.from([0x47, 0x49, 0x46, 0x38])],
    'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
    'application/zip': [Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from([0x50, 0x4b, 0x05, 0x06])],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
    'text/plain': [],
    'text/html': [Buffer.from([0x3c, 0x68, 0x74, 0x6d, 0x6c])],
    'application/json': [],
    'text/csv': []
}

export async function validateFileContent(fileBuffer: Buffer, declaredMimeType: string, allowedMimeTypes: string[]): Promise<boolean> {
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(declaredMimeType)) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, `File type '${declaredMimeType}' is not in the allowed types list`)
    }

    return validateFileSignature(fileBuffer, declaredMimeType)
}

function validateFileSignature(fileBuffer: Buffer, mimeType: string): boolean {
    if (fileBuffer.length === 0) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'File is empty')
    }

    const signatures = FILE_SIGNATURES[mimeType]
    if (!signatures || signatures.length === 0) {
        return true
    }

    const matches = signatures.some((signature) => {
        if (fileBuffer.length < signature.length) {
            return false
        }
        for (let i = 0; i < signature.length; i++) {
            if (fileBuffer[i] !== signature[i]) {
                return false
            }
        }
        return true
    })

    if (!matches) {
        throw new InternalAutonomousError(
            StatusCodes.BAD_REQUEST,
            `File content does not match expected file type signature for ${mimeType}. Possible file type spoofing detected.`
        )
    }

    return true
}

export function validateFileSize(fileSize: number, maxSizeBytes: number): void {
    if (fileSize > maxSizeBytes) {
        const maxSizeMB = (maxSizeBytes / 1024 / 1024).toFixed(2)
        const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2)
        throw new InternalAutonomousError(
            StatusCodes.BAD_REQUEST,
            `File size (${fileSizeMB} MB) exceeds maximum allowed size (${maxSizeMB} MB)`
        )
    }

    if (fileSize === 0) {
        throw new InternalAutonomousError(StatusCodes.BAD_REQUEST, 'File is empty')
    }
}
