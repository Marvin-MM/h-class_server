import type { NotesRepository } from "./repository.js";
import type { CoursesRepository } from "../courses/repository.js";
import type { MediaService } from "../media/service.js";
import type { S3StorageClient } from "../../infrastructure/s3.js";
import type { CreateNoteDto } from "./dto.js";
import type { NoteResponse } from "./types.js";
import { ALLOWED_CONTENT_TYPES } from "../media/service.js";
import {
  NotFoundError,
  AuthorizationError,
} from "../../shared/errors/index.js";
import { logger } from "../../shared/utils/logger.js";

export class NotesService {
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly coursesRepository: CoursesRepository,
    private readonly mediaService: MediaService,
    private readonly s3Client: S3StorageClient,
  ) {}

  /**
   * Generates a pre-signed upload URL for a note file.
   * Only the course tutor can upload notes.
   */
  async getUploadUrl(
    tutorId: string,
    courseId: string,
    contentType: string,
    fileName: string,
  ) {
    const course = await this.coursesRepository.findById(courseId);
    if (!course) throw new NotFoundError("Course", courseId);
    if (course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only upload notes for your own courses",
      );

    const prefix = `notes/${courseId}`;

    return this.mediaService.generateUploadUrl({
      prefix,
      contentType,
      fileName,
      allowedContentTypes: [...ALLOWED_CONTENT_TYPES.notes],
      maxFileSizeMb: 50,
    });
  }

  /**
   * Creates a note record after the tutor has uploaded the file to S3.
   */
  async createNote(tutorId: string, dto: CreateNoteDto): Promise<NoteResponse> {
    const course = await this.coursesRepository.findById(dto.courseId);
    if (!course) throw new NotFoundError("Course", dto.courseId);
    if (course.tutorId !== tutorId)
      throw new AuthorizationError(
        "You can only create notes for your own courses",
      );

    const note = await this.notesRepository.create({
      courseId: dto.courseId,
      sessionId: dto.sessionId,
      tutorId,
      title: dto.title,
      s3Key: dto.s3Key,
    });

    logger.info("Note created", { noteId: note.id, courseId: dto.courseId });
    return this.toResponse(note);
  }

  /**
   * Retrieves all notes for a course with pre-signed download URLs.
   * Accessible by the course tutor or enrolled students.
   */
  async getCourseNotes(
    courseId: string,
    userId: string,
  ): Promise<NoteResponse[]> {
    const notes = await this.notesRepository.findByCourseId(courseId, userId);
    return Promise.all(notes.map((note) => this.toResponseWithUrl(note)));
  }

  /**
   * Retrieves a download URL for a specific note.
   * Accessible by the course tutor or enrolled students.
   */
  async getNoteDownloadUrl(
    noteId: string,
    userId: string,
  ): Promise<{ downloadUrl: string }> {
    const note = await this.notesRepository.findById(noteId);
    if (!note) throw new NotFoundError("Note", noteId);

    // Check access: must be tutor or enrolled student
    const course = await this.coursesRepository.findById(note.courseId);
    if (!course) throw new NotFoundError("Course", note.courseId);

    if (course.tutorId !== userId) {
      const isEnrolled = await this.coursesRepository.isEnrolled(
        userId,
        note.courseId,
      );
      if (!isEnrolled)
        throw new AuthorizationError(
          "You must be enrolled in the course to access notes",
        );
    }

    const downloadUrl = await this.s3Client.generatePresignedGetUrl(
      note.s3Key,
      604800, // 7 days (max for AWS IAM long-term credentials)
    );
    return { downloadUrl };
  }

  private toResponse(note: {
    id: string;
    courseId: string;
    sessionId: string | null;
    tutorId: string;
    title: string;
    s3Key: string;
    createdAt: Date;
    updatedAt: Date;
  }): NoteResponse {
    return {
      id: note.id,
      courseId: note.courseId,
      sessionId: note.sessionId,
      tutorId: note.tutorId,
      title: note.title,
      s3Key: note.s3Key,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  private async toResponseWithUrl(note: {
    id: string;
    courseId: string;
    sessionId: string | null;
    tutorId: string;
    title: string;
    s3Key: string;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<NoteResponse> {
    const downloadUrl = await this.s3Client.generatePresignedGetUrl(
      note.s3Key,
      604800, // 7 days
    );
    return {
      id: note.id,
      courseId: note.courseId,
      sessionId: note.sessionId,
      tutorId: note.tutorId,
      title: note.title,
      s3Key: note.s3Key,
      downloadUrl,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}
