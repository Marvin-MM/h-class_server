import type { NotesRepository } from './repository.js';
import type { CoursesRepository } from '../courses/repository.js';
import type { CreateNoteDto } from './dto.js';
import type { NoteResponse } from './types.js';
import { NotFoundError, AuthorizationError } from '../../shared/errors/index.js';
import { logger } from '../../shared/utils/logger.js';

export class NotesService {
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly coursesRepository: CoursesRepository,
  ) {}

  async createNote(tutorId: string, dto: CreateNoteDto): Promise<NoteResponse> {
    const course = await this.coursesRepository.findById(dto.courseId);
    if (!course) throw new NotFoundError('Course', dto.courseId);
    if (course.tutorId !== tutorId) throw new AuthorizationError('You can only create notes for your own courses');

    const note = await this.notesRepository.create({
      courseId: dto.courseId,
      sessionId: dto.sessionId,
      tutorId,
      title: dto.title,
      s3Key: dto.s3Key,
    });

    logger.info('Note created', { noteId: note.id, courseId: dto.courseId });
    return this.toResponse(note);
  }

  async getCourseNotes(courseId: string, userId: string): Promise<NoteResponse[]> {
    const notes = await this.notesRepository.findByCourseId(courseId, userId);
    return notes.map(this.toResponse);
  }

  private toResponse(note: { id: string; courseId: string; sessionId: string | null; tutorId: string; title: string; s3Key: string; createdAt: Date; updatedAt: Date }): NoteResponse {
    return { id: note.id, courseId: note.courseId, sessionId: note.sessionId, tutorId: note.tutorId, title: note.title, s3Key: note.s3Key, createdAt: note.createdAt, updatedAt: note.updatedAt };
  }
}
