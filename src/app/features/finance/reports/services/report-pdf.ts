import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { ToastService } from '../../../../shared/ui/toast/toast.service';

@Injectable({
  providedIn: 'root',
})
export class ReportPdfService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastService = inject(ToastService);

  private readonly exporting = signal(false);

  readonly isExportingPdf = this.exporting.asReadonly();

  async exportReportPdf(rangeLabel: string, fileName: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.exporting()) {
      return;
    }

    const reportElement = this.document.querySelector<HTMLElement>('.reports-page');

    if (!reportElement) {
      this.toastService.error('No se ha podido preparar el informe PDF.');
      return;
    }

    this.exporting.set(true);
    reportElement.classList.add('is-exporting');

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.setProperties({
        title: `Finora - Informe ${rangeLabel}`,
        subject: 'Informe financiero generado desde Finora',
        author: 'Finora',
      });

      const margin = 10;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      const pixelsPerMillimeter = canvas.width / printableWidth;
      const pageHeightInPixels = Math.floor(printableHeight * pixelsPerMillimeter);

      let currentOffset = 0;
      let pageIndex = 0;

      while (currentOffset < canvas.height) {
        const sliceHeight = Math.min(pageHeightInPixels, canvas.height - currentOffset);
        const pageCanvas = this.document.createElement('canvas');

        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const context = pageCanvas.getContext('2d');

        if (!context) {
          throw new Error('No se ha podido generar el lienzo del PDF.');
        }

        context.drawImage(
          canvas,
          0,
          currentOffset,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        if (pageIndex > 0) {
          pdf.addPage();
        }

        const imageHeight = sliceHeight / pixelsPerMillimeter;

        pdf.addImage(
          pageCanvas.toDataURL('image/png'),
          'PNG',
          margin,
          margin,
          printableWidth,
          imageHeight,
          undefined,
          'FAST',
        );

        currentOffset += sliceHeight;
        pageIndex++;
      }

      pdf.save(fileName);
      this.toastService.success('Informe PDF exportado correctamente.');
    } catch {
      this.toastService.error('No se ha podido generar el informe PDF.');
    } finally {
      reportElement.classList.remove('is-exporting');
      this.exporting.set(false);
    }
  }
}
