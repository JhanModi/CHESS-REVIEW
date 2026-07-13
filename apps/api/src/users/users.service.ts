import { Injectable, NotFoundException } from "@nestjs/common";
import type { User } from "@tempo/db";
import type { UpdateSettingsRequest, UserDto } from "@tempo/types";
import { PrismaService } from "../prisma/prisma.service.js";

function toDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    plan: user.plan,
    settings: (user.settings as Record<string, unknown>) ?? {},
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return toDto(user);
  }

  async updateSettings(userId: string, dto: UpdateSettingsRequest): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    const current = (user.settings as Record<string, unknown>) ?? {};
    const merged = {
      ...current,
      ...(dto.boardTheme !== undefined ? { boardTheme: dto.boardTheme } : {}),
      ...(dto.language !== undefined ? { language: dto.language } : {}),
      ...(dto.thresholds !== undefined
        ? { thresholds: { ...(current.thresholds as object | undefined), ...dto.thresholds } }
        : {}),
    };
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { settings: merged } });
    return toDto(updated);
  }
}
