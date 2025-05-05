import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
  } from 'class-validator';
  
  @ValidatorConstraint({ name: 'isGreaterThanOrEqual', async: false })
  export class IsGreaterThanOrEqualConstraint implements ValidatorConstraintInterface {
    validate(value: any, args: ValidationArguments) {
      const [relatedPropertyName] = args.constraints;
      const relatedValue = (args.object as any)[relatedPropertyName];
  
      // Only validate if the related property exists and the current value exists
      if (relatedValue === undefined || relatedValue === null || value === undefined || value === null) {
        return true; // Let other validators (@IsOptional, @IsNumber) handle missing values
      }
  
      // Ensure both are numbers before comparing
      if (typeof value !== 'number' || typeof relatedValue !== 'number') {
          return false; // Or true, depending if you want @IsNumber to catch this
      }
  
      return value >= relatedValue;
    }
  
    defaultMessage(args: ValidationArguments) {
      const [relatedPropertyName] = args.constraints;
      return `$property must not be less than ${relatedPropertyName}`;
    }
  }
  
  export function IsGreaterThanOrEqual(property: string, validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
      registerDecorator({
        target: object.constructor,
        propertyName: propertyName,
        options: validationOptions,
        constraints: [property],
        validator: IsGreaterThanOrEqualConstraint,
      });
    };
  }