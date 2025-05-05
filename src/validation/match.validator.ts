import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
    registerDecorator,
    ValidationOptions,
  } from 'class-validator';
  
  @ValidatorConstraint({ name: 'match', async: false })
  export class MatchConstraint implements ValidatorConstraintInterface {
    validate(value: any, args: ValidationArguments) {
      const [relatedPropertyName] = args.constraints;
      const relatedValue = (args.object as any)[relatedPropertyName];
      return value === relatedValue; // Check if value matches the related property's value
    }
  
    defaultMessage(args: ValidationArguments) {
      const [relatedPropertyName] = args.constraints;
      // Dynamically create message like "confirmPassword must match newPassword"
      return `$property must match ${relatedPropertyName}`;
    }
  }
  
  /**
   * Custom decorator to check if the value of the decorated property matches the value of another property on the same object.
   * @param property The name of the other property to match against.
   * @param validationOptions Standard class-validator options.
   */
  export function Match(property: string, validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
      registerDecorator({
        target: object.constructor,
        propertyName: propertyName,
        options: validationOptions,
        constraints: [property], // Pass the related property name as a constraint
        validator: MatchConstraint, // Use the custom constraint class
      });
    };
  }