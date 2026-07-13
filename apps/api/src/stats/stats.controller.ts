import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser, type RequestUser } from "../common/decorators.js";
import { StatsService } from "./stats.service.js";

@ApiTags("stats")
@ApiBearerAuth()
@Controller("stats")
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get("dashboard")
  @ApiOperation({ summary: "Dashboard aggregates: win rate, accuracy, trends, openings" })
  dashboard(@CurrentUser() user: RequestUser) {
    return this.stats.dashboard(user.id);
  }
}
