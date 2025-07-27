// dto/create-tenant.dto.ts
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
export class CreateTenantDto {
  @IsString() slug!: string;
  @IsInt() @Min(1) @Max(60) @IsOptional() trialDays?: number = 14;
}
