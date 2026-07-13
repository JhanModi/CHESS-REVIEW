import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { updateSettingsSchema, type UpdateSettingsRequest, type UserDto } from "@tempo/types";
import { CurrentUser, type RequestUser } from "../common/decorators.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { UsersService } from "./users.service.js";

@ApiTags("users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "The authenticated user's profile and settings" })
  me(@CurrentUser() user: RequestUser): Promise<UserDto> {
    return this.users.me(user.id);
  }

  @Patch("me/settings")
  @ApiOperation({ summary: "Update preferences (classification thresholds, board theme, language)" })
  updateSettings(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) dto: UpdateSettingsRequest,
  ): Promise<UserDto> {
    return this.users.updateSettings(user.id, dto);
  }
}
