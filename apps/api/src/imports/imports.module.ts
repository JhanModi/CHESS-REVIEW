import { Module } from "@nestjs/common";
import { GamesModule } from "../games/games.module.js";
import { ImportsController } from "./imports.controller.js";
import { ImportsService } from "./imports.service.js";
import { ChesscomClient, LichessClient } from "./platform-clients.js";

@Module({
  imports: [GamesModule],
  controllers: [ImportsController],
  providers: [ImportsService, LichessClient, ChesscomClient],
})
export class ImportsModule {}
