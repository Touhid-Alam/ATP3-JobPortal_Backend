import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ResumeMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const filename = req.params.filename;
    
    // Validate filename format (userId_Resume.ext)
    if (!filename.match(/^\d+_Resume\.(pdf|doc|docx)$/)) {
      return res.status(400).json({
        statusCode: 400,
        message: 'Invalid filename format'
      });
    }

    const filePath = join(process.cwd(), 'uploads', 'resumes', filename);

    if (!existsSync(filePath)) {
      return res.status(404).json({
        statusCode: 404,
        message: 'Resume not found'
      });
    }

    next();
  }
}