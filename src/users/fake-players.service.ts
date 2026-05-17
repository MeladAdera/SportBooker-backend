import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Faker, en, faker as defaultFaker } from '@faker-js/faker';
import { randomUUID } from 'crypto';
import type { CreateFakePlayerDto } from './dto/create-fake-player.dto';
import type { FakePlayerResponseDto } from './dto/fake-player-response.dto';
import {
  DayOfWeek,
  DominantFoot,
  PlayerPosition,
  SkillLevel,
} from './player-profile.enums';
import type { FakePlayerRow } from './users.repository';
import { UsersRepository } from './users.repository';

const SKILL_LEVELS: SkillLevel[] = [
  SkillLevel.Beginner,
  SkillLevel.Intermediate,
  SkillLevel.Advanced,
];
const POSITIONS: PlayerPosition[] = [
  PlayerPosition.Goalkeeper,
  PlayerPosition.Defender,
  PlayerPosition.Midfielder,
  PlayerPosition.Forward,
];
const FEET: DominantFoot[] = [
  DominantFoot.Left,
  DominantFoot.Right,
  DominantFoot.Both,
];
const DAYS: DayOfWeek[] = [
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
  DayOfWeek.Friday,
  DayOfWeek.Saturday,
  DayOfWeek.Sunday,
];

/**
 * Generates and persists `is_fake = true` users that look real to public APIs
 * but cannot log in, cannot pay, and never receive notifications. Used by tenant
 * admins to seed demo / marketing-friendly state on a fresh tenant.
 */
@Injectable()
export class FakePlayersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createOne(
    tenantId: string,
    dto: CreateFakePlayerDto,
  ): Promise<FakePlayerResponseDto> {
    const profile = this.buildProfile(defaultFaker, dto);
    const row = await this.usersRepository.insertFakePlayer({
      tenantId,
      ...profile,
    });
    return this.toDto(row);
  }

  async createBulk(
    tenantId: string,
    count: number,
    seed?: number,
  ): Promise<FakePlayerResponseDto[]> {
    const faker =
      seed !== undefined ? this.makeSeededFaker(seed) : defaultFaker;
    const profiles = Array.from({ length: count }, () =>
      this.buildProfile(faker, {}),
    );
    const rows = await this.usersRepository.bulkInsertFakePlayers(
      tenantId,
      profiles,
    );
    return rows.map((row) => this.toDto(row));
  }

  async deleteFakePlayer(tenantId: string, userId: string): Promise<void> {
    const ok = await this.usersRepository.hardDeleteFakeUser(tenantId, userId);
    if (!ok) {
      throw new NotFoundException('Fake player not found');
    }
  }

  /**
   * Builds a player profile by merging caller-provided fields over faker-generated defaults.
   * Email is always synthesized server-side to keep `fake+...@fake.local` invariant.
   */
  private buildProfile(
    faker: { person: { firstName: () => string; lastName: () => string } },
    dto: CreateFakePlayerDto,
  ): {
    name: string;
    email: string;
    photoUrl: string | null;
    skillLevel: string | null;
    preferredPosition: string | null;
    dominantFoot: string | null;
    preferredDays: string[];
  } {
    const fakeId = randomUUID();
    const name =
      dto.name?.trim() ||
      `${faker.person.firstName()} ${faker.person.lastName()}`;
    const photoUrl = dto.photoUrl ?? `https://i.pravatar.cc/300?u=${fakeId}`;
    return {
      name,
      email: `fake+${fakeId}@fake.local`,
      photoUrl,
      skillLevel:
        dto.skillLevel ?? FakePlayersService.pick(defaultFaker, SKILL_LEVELS),
      preferredPosition:
        dto.preferredPosition ??
        FakePlayersService.pick(defaultFaker, POSITIONS),
      dominantFoot:
        dto.dominantFoot ?? FakePlayersService.pick(defaultFaker, FEET),
      preferredDays: dto.preferredDays ?? FakePlayersService.pickDays(),
    };
  }

  private toDto(row: FakePlayerRow): FakePlayerResponseDto {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      photoUrl: row.photo_url,
      skillLevel: (row.skill_level as SkillLevel | null) ?? null,
      preferredPosition:
        (row.preferred_position as PlayerPosition | null) ?? null,
      dominantFoot: (row.dominant_foot as DominantFoot | null) ?? null,
      preferredDays: (row.preferred_days ?? []) as DayOfWeek[],
      createdAt: row.created_at.toISOString(),
    };
  }

  private static pick<T>(_faker: unknown, items: T[]): T {
    const idx = Math.floor(Math.random() * items.length);
    const value = items[idx];
    if (value === undefined) {
      throw new ServiceUnavailableException(
        'Failed to pick a fake-profile attribute',
      );
    }
    return value;
  }

  private static pickDays(): DayOfWeek[] {
    const count = 1 + Math.floor(Math.random() * 4);
    const shuffled = [...DAYS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private makeSeededFaker(seed: number): Faker {
    const seeded = new Faker({ locale: [en] });
    seeded.seed(seed);
    return seeded;
  }
}
