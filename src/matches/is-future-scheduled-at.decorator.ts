import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/** Rejects dates that are not strictly after `Date.now()` (UTC). */
export function IsFutureScheduledAt(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isFutureScheduledAt',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== 'string') return false;
          const t = Date.parse(value);
          if (Number.isNaN(t)) return false;
          return t > Date.now();
        },
        defaultMessage() {
          return 'scheduledAt must be in the future';
        },
      },
    });
  };
}
