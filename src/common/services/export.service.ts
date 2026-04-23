import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ExportColumn {
  header: string;
  key: string;
  width?: number;
  formatter?: (value: any, row: any) => any;
}

@Injectable()
export class ExportService {
  async exportToExcel(
    data: any[],
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
      const rowData: Record<string, any> = {};
      for (const col of columns) {
        const rawValue = row[col.key];
        rowData[col.key] = col.formatter
          ? col.formatter(rawValue, row)
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
