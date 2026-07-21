import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  createGamesSchema,
  listGamesQuerySchema,
  type ClearGamesResultDto,
  type CreateGamesRequest,
  type ListGamesQuery,
} from "@tempo/types";
import { CurrentUser, Public, type RequestUser } from "../common/decorators.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { GamesService } from "./games.service.js";

@ApiTags("games")
@ApiBearerAuth()
@Controller("games")
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  @ApiOperation({ summary: "Import games from a PGN payload (paste or upload)" })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createGamesSchema)) dto: CreateGamesRequest,
  ) {
    return this.games.createFromPgn(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the user's games (cursor-paginated)" })
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listGamesQuerySchema)) query: ListGamesQuery,
  ) {
    return this.games.list(user.id, query);
  }

  @Delete()
  @ApiOperation({ summary: "Delete ALL of the user's games and their analysis" })
  clearAll(@CurrentUser() user: RequestUser): Promise<ClearGamesResultDto> {
    return this.games.deleteAll(user.id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Full game detail: moves, analysis, opening" })
  get(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.games.getDetail(user.id, id);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a game and its analysis" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.games.delete(user.id, id);
  }

  @Post(":id/share")
  @ApiOperation({ summary: "Create (or return) the public share link for a game" })
  share(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.games.share(user.id, id);
  }

  @Delete(":id/share")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke a game's public share link" })
  async unshare(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.games.unshare(user.id, id);
  }
}

@ApiTags("share")
@Controller("share")
export class ShareController {
  constructor(private readonly games: GamesService) {}

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "Publicly shared game (no auth)" })
  get(@Param("slug") slug: string) {
    return this.games.getSharedDetail(slug);
  }
}
