import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppConfig } from "../config/index.js";

/** Options for generating a pre-signed upload URL. */
export interface PreSignedUploadOptions {
  readonly key: string;
  readonly contentType: string;
  readonly expiresIn?: number;
}

/** Result of generating a pre-signed upload URL. */
export interface PreSignedUploadResult {
  readonly uploadUrl: string;
  readonly key: string;
}

/**
 * S3 storage adapter providing pre-signed URL generation for direct client uploads.
 */
export class S3StorageClient {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor(config: AppConfig) {
    this.client = new S3Client({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = config.S3_BUCKET_NAME;
  }

  /**
   * Generates a pre-signed PUT URL for direct file upload to S3.
   * @param options - Upload options including key, content type, and optional expiry
   * @returns The pre-signed URL and the S3 key
   */
  async generatePresignedPutUrl(
    options: PreSignedUploadOptions,
  ): Promise<PreSignedUploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: options.key,
      ContentType: options.contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: options.expiresIn ?? 300, // 5 minutes default
    });

    return { uploadUrl, key: options.key };
  }

  /**
   * Generates a pre-signed GET URL for reading a file from S3.
   * @param key - The S3 object key
   * @param expiresIn - URL expiry in seconds (default: 3600)
   * @returns The pre-signed download URL
   */
  async generatePresignedGetUrl(
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }
}
