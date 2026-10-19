import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ReportPdfService } from './report-pdf';

describe('ReportPdfService', () => {
  let service: ReportPdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportPdfService,
        {
          provide: PLATFORM_ID,
          useValue: 'server',
        },
        {
          provide: ToastService,
          useValue: {
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
    });

    service = TestBed.inject(ReportPdfService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize without an active export', () => {
    expect(service.isExportingPdf()).toBe(false);
  });

  it('should not export outside the browser', async () => {
    await service.exportReportPdf('Octubre 2026', 'finora-informe.pdf');

    expect(service.isExportingPdf()).toBe(false);
  });
});
