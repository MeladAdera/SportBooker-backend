/** Matches DB enum `booking_position` (migration 031). */
export enum BookingPosition {
  FieldPlayer = 'field_player',
  Goalkeeper = 'goalkeeper',
}

/** Enforced in BookingsRepository when confirming or promoting from waitlist. */
export const MAX_GOALKEEPERS_PER_MATCH = 2;
