import type { Request, Response, NextFunction } from 'express';
import type { NotesService } from './service.js';
import type { CreateNoteDto } from './dto.js';
import { sendSuccess } from '../../shared/utils/response.js';

export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const note = await this.notesService.createNote(req.user!.userId, req.body as CreateNoteDto);
      sendSuccess(res, note, 201);
    } catch (error) { next(error); }
  };

  getByCourse = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const notes = await this.notesService.getCourseNotes(String(req.params['courseId']), req.user!.userId);
      sendSuccess(res, notes);
    } catch (error) { next(error); }
  };
}
