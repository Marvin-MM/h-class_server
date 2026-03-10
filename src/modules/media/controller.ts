import type { Request, Response, NextFunction } from 'express';
import type { MediaService } from './service.js';
import type { UploadUrlDto } from './dto.js';
import { sendSuccess } from '../../shared/utils/response.js';

/**
 * Controller for media upload endpoints.
 */
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  /** POST /media/upload-url */
  getUploadUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = req.body as UploadUrlDto;
      const result = await this.mediaService.generateUploadUrl({
        prefix: dto.prefix,
        contentType: dto.contentType,
        fileName: dto.fileName,
        allowedContentTypes: [dto.contentType], // Caller specifies their own allowed types
        maxFileSizeMb: 50,
      });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
