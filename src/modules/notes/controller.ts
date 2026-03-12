import type { Request, Response, NextFunction } from "express";
import type { NotesService } from "./service.js";
import type { CreateNoteDto, NoteUploadUrlDto } from "./dto.js";
import { sendSuccess } from "../../shared/utils/response.js";

export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /** POST /notes/upload-url — Get a pre-signed URL for uploading a note file (tutor only). */
  getUploadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as NoteUploadUrlDto;
      const result = await this.notesService.getUploadUrl(
        req.user!.userId,
        dto.courseId,
        dto.contentType,
        dto.fileName,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };

  /** POST /notes — Create a note record after uploading (tutor only). */
  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const note = await this.notesService.createNote(
        req.user!.userId,
        req.body as CreateNoteDto,
      );
      sendSuccess(res, note, 201);
    } catch (error) {
      next(error);
    }
  };

  /** GET /notes/course/:courseId — Get all notes for a course with download URLs. */
  getByCourse = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const notes = await this.notesService.getCourseNotes(
        String(req.params["courseId"]),
        req.user!.userId,
      );
      sendSuccess(res, notes);
    } catch (error) {
      next(error);
    }
  };

  /** GET /notes/:id/download — Get a download URL for a specific note. */
  getDownloadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.notesService.getNoteDownloadUrl(
        String(req.params["id"]),
        req.user!.userId,
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  };
}
