import { PartialType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from './create-employee.dto'; // Ensure this path is correct

// PartialType makes all fields inherited from CreateEmployeeDto optional.
// This is suitable for PATCH operations. For PUT, you might want a separate DTO
// or enforce all fields in the controller/service if PUT implies full replacement.
export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}