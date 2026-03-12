import type { Request, Response, NextFunction } from "express";
import type { MediaService } from "./service.js";
import type { UploadUrlDto } from "./dto.js";
import { ALLOWED_CONTENT_TYPES } from "./service.js";
import { sendSuccess } from "../../shared/utils/response.js";

/**
 * Resolves the allowed content types based on the requested upload prefix.
 * Falls back to a strict default if the prefix is unknown.
 */
function resolveAllowedTypes(prefix: string): string[] {
  if (prefix.startsWith("notes/")) return [...ALLOWED_CONTENT_TYPES.notes];
  if (prefix.startsWith("submissions/"))
    return [...ALLOWED_CONTENT_TYPES.submissions];
  if (prefix.startsWith("avatars/")) return [...ALLOWED_CONTENT_TYPES.avatars];
  if (prefix.startsWith("assessments/"))
    return [...ALLOWED_CONTENT_TYPES.notes]; // Same doc types
  // Default: allow common document types
  return [...ALLOWED_CONTENT_TYPES.notes];
}

/**
 * Controller for media upload endpoints.
 */
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** POST /media/upload-url */
  getUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as UploadUrlDto;
      const allowedContentTypes = resolveAllowedTypes(dto.prefix);

      const result = await this.mediaService.generateUploadUrl({
        prefix: dto.prefix,
        contentType: dto.contentType,
        fileName: dto.fileName,
        allowedContentTypes,
        maxFileSizeMb: 50,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
