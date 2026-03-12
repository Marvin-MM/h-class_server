import { v2 as cloudinary } from "cloudinary";
import type { AppConfig } from "../config/index.js";

/**
 * Creates and configures a Cloudinary API client instance for image transformations and uploads.
 */
export function createCloudinaryClient(config: AppConfig): typeof cloudinary {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return cloudinary;
}
