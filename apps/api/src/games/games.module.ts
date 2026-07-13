import { Module } from "@nestjs/common";
import { GamesController, ShareController } from "./games.controller.js";
import { GamesService } from "./games.service.js";

@Module({
  controllers: [GamesController, ShareController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
