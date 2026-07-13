import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { evalCacheQuerySchema, submitAnalysisSchema, type SubmitAnalysisRequest } from "@tempo/types";
import { CurrentUser, type RequestUser } from "../common/decorators.js";
import { ZodValidationPipe } from "../common/zod.pipe.js";
import { AnalysisService } from "./analysis.service.js";

@ApiTags("analysis")
@ApiBearerAuth()
@Controller()
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Put("games/:id/analysis")
  @ApiOperation({
    summary: "Submit raw engine evaluations (incremental batches); server derives classifications",
  })
  submit(
    @CurrentUser() user: RequestUser,
    @Param("id") gameId: string,
    @Body(new ZodValidationPipe(submitAnalysisSchema)) dto: SubmitAnalysisRequest,
  ) {
    return this.analysis.submit(user.id, gameId, dto);
  }

  @Get("games/:id/analysis")
  @ApiOperation({ summary: "Current analysis state for a game" })
  get(@CurrentUser() user: RequestUser, @Param("id") gameId: string) {
    return this.analysis.get(user.id, gameId);
  }

  @Get("evals")
  @ApiOperation({ summary: "Shared position-eval cache lookup (comma-separated EPDs)" })
  lookup(@Query(new ZodValidationPipe(evalCacheQuerySchema)) query: { epds: string }) {
    return this.analysis.lookup(query.epds.split(",").map((epd) => epd.trim()).filter(Boolean));
  }
}
