import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  formatter?: (value: unknown, row: Record<string, unknown>) => unknown;
}

@Injectable()
export class ExportService {
  async exportToExcel(
    data: unknown[],
    columns: ExportColumn[],
    sheetName: string = 'Sheet1',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || 20,
    }));

    for (const row of data) {
      const rowRecord = row as Record<string, unknown>;
      const rowData: Record<string, unknown> = {};
      for (const col of columns) {
        const rawValue = rowRecord[col.key];
        rowData[col.key] = col.formatter
          ? col.formatter(rawValue, rowRecord)
          : rawValue;
      }
      worksheet.addRow(rowData);
    }

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
  }
}
