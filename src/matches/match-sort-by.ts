export enum MatchSortBy {
  ScheduledAtAsc = 'scheduled_at_asc',
  ScheduledAtDesc = 'scheduled_at_desc',
  PriceAsc = 'price_asc',
  PriceDesc = 'price_desc',
  SpotsAsc = 'spots_remaining_asc',
  SpotsDesc = 'spots_remaining_desc',
}

export const DEFAULT_MATCH_SORT = MatchSortBy.ScheduledAtAsc;

/** Maps validated enum value → SQL ORDER BY fragment (no user input reaches SQL). */
export const SORT_BY_SQL: Record<MatchSortBy, string> = {
  [MatchSortBy.ScheduledAtAsc]: 'm.scheduled_at ASC',
  [MatchSortBy.ScheduledAtDesc]: 'm.scheduled_at DESC',
  [MatchSortBy.PriceAsc]: 'm.price_per_player ASC',
  [MatchSortBy.PriceDesc]: 'm.price_per_player DESC',
  [MatchSortBy.SpotsAsc]:
    'GREATEST(0, COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0)) ASC',
  [MatchSortBy.SpotsDesc]:
    'GREATEST(0, COALESCE(m.max_players, 0) - COALESCE(bc.confirmed_count, 0)) DESC',
};
