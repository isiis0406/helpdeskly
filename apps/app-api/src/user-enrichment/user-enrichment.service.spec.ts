import { Test, TestingModule } from '@nestjs/testing';
import { UserEnrichmentService } from './user-enrichment.service';

describe('UserEnrichmentService', () => {
  let service: UserEnrichmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserEnrichmentService],
    }).compile();

    service = module.get<UserEnrichmentService>(UserEnrichmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
