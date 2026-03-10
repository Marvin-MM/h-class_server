import type { Request, Response, NextFunction } from 'express';
import type { CertificatesService } from './service.js';
import { sendSuccess } from '../../shared/utils/response.js';

export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cert = await this.certificatesService.getCertificate(String(req.params['id']), req.user!.userId);
      sendSuccess(res, cert);
    } catch (error) { next(error); }
  };

  getMy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, await this.certificatesService.getStudentCertificates(req.user!.userId));
    } catch (error) { next(error); }
  };
}
