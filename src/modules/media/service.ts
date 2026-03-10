import { nanoid } from 'nanoid';
import type { S3StorageClient } from '../../infrastructure/s3.js';
import type { UploadUrlOptions, UploadUrlResult } from './types.js';
import { ValidationError } from '../../shared/errors/index.js';

/** Content types allowed for different resource types. */
export const ALLOWED_CONTENT_TYPES = {
  notes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
  submissions: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
  avatars: [
    'image/jpeg',
    'image/png',
    'image/webp',
  ],
} as const;

/**
 * Service handling pre-signed S3 URL generation for all file uploads.
 * All modules that need file uploads delegate to this service.
 */
export class MediaService {
  constructor(private readonly s3Client: S3StorageClient) {}

  /**
   * Generates a pre-signed PUT URL for file upload to S3.
   * Validates content type against the allowed list before generating.
   *
   * @param options - Upload options specifying prefix, content type, allowed types, etc.
   * @returns The pre-signed URL and the full S3 key
   */
  async generateUploadUrl(options: UploadUrlOptions): Promise<UploadUrlResult> {
    // Validate content type
    if (!options.allowedContentTypes.includes(options.contentType)) {
      throw new ValidationError('Invalid content type', {
        contentType: [`Allowed types: ${options.allowedContentTypes.join(', ')}`],
      });
    }

    // Generate a unique S3 key using the prefix, a unique ID, and the original filename
    const uniqueId = nanoid(16);
    const sanitizedFileName = options.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${options.prefix}/${uniqueId}/${sanitizedFileName}`;

    const result = await this.s3Client.generatePresignedPutUrl({
      key,
      contentType: options.contentType,
      expiresIn: 300, // 5 minutes
    });

    return result;
  }
}
