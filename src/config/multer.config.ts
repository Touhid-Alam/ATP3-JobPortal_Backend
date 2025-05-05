import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { Request } from 'express'; // Import Request type

// Define the destination directory relative to the project root
const UPLOAD_DIR = './uploads/resumes'; // Store in project root/uploads/resumes

// Ensure the upload directory exists
const ensureUploadDirExists = () => {
  if (!existsSync(UPLOAD_DIR)) {
    console.log(`Upload directory ${UPLOAD_DIR} not found. Creating...`);
    mkdirSync(UPLOAD_DIR, { recursive: true }); // Create nested directories if needed
  }
};

// Define the storage engine
export const resumeStorage = diskStorage({
  // Destination storage path function
  destination: (req: Request, file: Express.Multer.File, cb: any) => {
    ensureUploadDirExists(); // Make sure the directory exists before saving
    cb(null, UPLOAD_DIR);
  },
  // File modification details
  filename: (req: Request & { user?: any }, file: Express.Multer.File, cb: any) => {
    // Get user ID from request (added by JwtAuthGuard/JwtStrategy)
    const userId = req.user?.userId;
    if (!userId) {
      // This shouldn't happen if the guard is working, but handle defensively
      return cb(new HttpException('User ID not found in request', HttpStatus.UNAUTHORIZED), false);
    }
    // Construct filename: UserID_Resume.ext
    const fileExtName = extname(file.originalname);
    const newFilename = `${userId}_Resume${fileExtName}`;

    // --- Overwrite Logic ---
    // Check if a file with the same name already exists and delete it
    const fullPath = join(UPLOAD_DIR, newFilename);
    if (existsSync(fullPath)) {
        try {
            unlinkSync(fullPath); // Delete existing file
            console.log(`Overwriting existing resume: ${newFilename}`);
        } catch (err) {
            console.error(`Error deleting existing file ${newFilename}:`, err);
            // Decide if you want to stop the upload or continue
            // return cb(new HttpException('Could not overwrite existing file', HttpStatus.INTERNAL_SERVER_ERROR), false);
        }
    }
    // --- End Overwrite Logic ---

    cb(null, newFilename);
  },
});

// Define the file filter
export const resumeFileFilter = (req: Request, file: Express.Multer.File, cb: any) => {
  // Allowed file extensions
  const allowedMimes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedMimes.includes(file.mimetype)) {
    // Accept file
    cb(null, true);
  } else {
    // Reject file
    console.error(`Unsupported file type uploaded: ${file.mimetype}, original name: ${file.originalname}`);
    cb(new HttpException(`Unsupported file type: Only PDF, DOC, DOCX allowed.`, HttpStatus.BAD_REQUEST), false);
  }
};

// Define file size limits
export const resumeLimits = {
    fileSize: 5 * 1024 * 1024, // 5MB limit (adjust as needed)
};