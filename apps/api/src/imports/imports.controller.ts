import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { importRequestSchema, type ImportRequest } from "@tempo/types";
import { CurrentUser, type RequestUser } from "../common/decorators.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { ImportsService } from "./imports.service.js";

@ApiTags("imports")
@ApiBearerAuth()
@Controller("imports")
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post("lichess")
  @ApiOperation({ summary: "Import a Lichess user's recent games (background job)" })
  importLichess(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(importRequestSchema)) dto: ImportRequest,
  ) {
    return this.imports.enqueue(user.id, "LICHESS", dto);
  }

  @Post("chesscom")
  @ApiOperation({ summary: "Import a Chess.com user's recent games (background job)" })
  importChesscom(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(importRequestSchema)) dto: ImportRequest,
  ) {
    return this.imports.enqueue(user.id, "CHESSCOM", dto);
  }

  @Get()
  @ApiOperation({ summary: "Recent import jobs" })
  list(@CurrentUser() user: RequestUser) {
    return this.imports.listRecent(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Import job progress" })
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.imports.get(user.id, id);
  }
}
