import type { Request, Response, NextFunction } from "express";
import type { CoursesService } from "./service.js";
import type { PaymentsService } from "../payments/service.js";
import type {
  CreateCourseDto,
  UpdateCourseDto,
  InitiateEnrollmentDto,
} from "./dto.js";
import { listCoursesSchema } from "./dto.js";
import { sendSuccess, sendPaginated } from "../../shared/utils/response.js";

/**
 * Controller for course endpoints.
 */
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /** POST /courses */
  create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const course = await this.coursesService.createCourse(
        req.user!.userId,
        req.body as CreateCourseDto,
      );
      sendSuccess(res, course, 201);
    } catch (error) {
      next(error);
    }
  };

  /** GET /courses */
  list = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = listCoursesSchema.parse(req.query);
      const result = await this.coursesService.listCourses(dto);
      sendPaginated(res, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  };

  /** GET /courses/:id */
  getById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const course = await this.coursesService.getCourse(
        String(req.params["id"]),
      );
      sendSuccess(res, course);
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /courses/:id */
  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const course = await this.coursesService.updateCourse(
        String(req.params["id"]),
        req.user!.userId,
        req.body as UpdateCourseDto,
      );
      sendSuccess(res, course);
    } catch (error) {
      next(error);
    }
  };

  /** POST /courses/:id/publish */
  publish = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const course = await this.coursesService.publishCourse(
        String(req.params["id"]),
        req.user!.userId,
      );
      sendSuccess(res, course);
    } catch (error) {
      next(error);
    }
  };

  /** POST /courses/:id/complete */
  complete = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const course = await this.coursesService.completeCourse(
        String(req.params["id"]),
        req.user!.userId,
      );
      sendSuccess(res, course);
    } catch (error) {
      next(error);
    }
  };

  /** POST /courses/:id/archive */
  archive = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const course = await this.coursesService.archiveCourse(
        String(req.params["id"]),
      );
      sendSuccess(res, course);
    } catch (error) {
      next(error);
    }
  };

  /** POST /courses/:id/enroll */
  enroll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as InitiateEnrollmentDto;
      const result = await this.paymentsService.initiatePayment(
        req.user!.userId,
        String(req.params["id"]),
        dto.phoneNumber,
        dto.paymentType,
      );
      sendSuccess(res, result, 202);
    } catch (error) {
      next(error);
    }
  };

  /** GET /courses/:id/students */
  getStudents = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const page = parseInt(req.query["page"] as string) || 1;
      const pageSize = parseInt(req.query["pageSize"] as string) || 20;
      const result = await this.coursesService.getCourseStudents(
        String(req.params["id"]),
        req.user!.userId,
        page,
        pageSize,
      );
      sendPaginated(res, result.data, { page, pageSize, total: result.total });
    } catch (error) {
      next(error);
    }
  };

  /** GET /courses/my-enrollments */
  getMyEnrollments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const page = parseInt(req.query["page"] as string) || 1;
      const pageSize = parseInt(req.query["pageSize"] as string) || 20;
      const result = await this.coursesService.getMyEnrollments(
        req.user!.userId,
        page,
        pageSize,
      );
      sendPaginated(res, result.data, { page, pageSize, total: result.total });
    } catch (error) {
      next(error);
    }
  };

  /** POST /courses/:id/pay-balance */
  payBalance = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const phoneNumber = (req.body as { phoneNumber: string }).phoneNumber;
      const result = await this.paymentsService.initiateBalancePayment(
        req.user!.userId,
        String(req.params["id"]),
        phoneNumber,
      );
      sendSuccess(res, result, 202);
    } catch (error) {
      next(error);
    }
  };
}
