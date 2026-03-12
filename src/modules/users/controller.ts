import type { Request, Response, NextFunction } from "express";
import type { UsersService } from "./service.js";
import type { UpdateProfileDto } from "./dto.js";
import { sendSuccess } from "../../shared/utils/response.js";
import { ValidationError } from "../../shared/errors/index.js";

/**
 * Controller for user profile endpoints.
 */
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /users/me */
  getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const profile = await this.usersService.getProfile(req.user!.userId);
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /users/me */
  updateProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as UpdateProfileDto;
      const profile = await this.usersService.updateProfile(
        req.user!.userId,
        dto,
      );
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  };

  /** POST /users/me/avatar */
  uploadAvatar = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError("A fresh avatar image file is required");
      }
      const profile = await this.usersService.uploadAvatar(
        req.user!.userId,
        req.file.buffer,
      );
      sendSuccess(res, profile);
    } catch (error) {
      next(error);
    }
  };

  /** DELETE /users/me */
  deleteAccount = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.usersService.deleteAccount(req.user!.userId);
      sendSuccess(res, { message: "Account deleted successfully" });
    } catch (error) {
      next(error);
    }
  };
}
