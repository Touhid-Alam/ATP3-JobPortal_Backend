import { PartialType } from '@nestjs/mapped-types';
import { CreateEducationDto } from './create-education.dto';

// Inherits validation rules from CreateEducationDto but makes all fields optional
export class UpdateEducationDto extends PartialType(CreateEducationDto) {}