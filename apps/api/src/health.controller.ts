import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "./common/decorators.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: "Liveness probe" })
  health(): { status: "ok"; time: string } {
    return { status: "ok", time: new Date().toISOString() };
  }
}
