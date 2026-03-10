/** Types specific to the Media module. */

/** Options for generating an upload URL. */
export interface UploadUrlOptions {
  readonly prefix: string;
  readonly contentType: string;
  readonly fileName: string;
  readonly allowedContentTypes: string[];
  readonly maxFileSizeMb: number;
}

/** Result of generating an upload URL. */
export interface UploadUrlResult {
  readonly uploadUrl: string;
  readonly key: string;
}
