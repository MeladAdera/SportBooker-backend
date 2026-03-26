import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { isValidIanaTimeZone } from '../iana-timezones';

@ValidatorConstraint({ name: 'isIanaTimeZone', async: false })
export class IsIanaTimeZoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }
    return typeof value === 'string' && isValidIanaTimeZone(value);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid IANA timezone identifier`;
  }
}

export function IsIanaTimeZone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIanaTimeZoneConstraint,
    });
  };
}
