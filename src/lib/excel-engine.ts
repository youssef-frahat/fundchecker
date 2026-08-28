// Excel Ingestion & Export Engine - ExcelJS Powered Pipeline

import ExcelJS from 'exceljs';
import { GeneratedTransactionRow, NettingRow, RawTransactionRow } from './types';
import { formatFinancialNumber } from './netting-engine';

/**
 * Computes SHA-256 hash of a file array buffer for duplicate upload detection.
 */
export async function computeFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Parses raw trading Excel file (up to 39 source columns) into RawTransactionRow objects.
 */
export async function parseTradingExcel(file: File): Promise<RawTransactionRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Workbook contains no worksheets.');
  }

  const rows: RawTransactionRow[] = [];
  const fileId = `file-${Date.now()}`;

  // Process rows starting from row 2 (skipping headers)
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    // Map column values (ExcelJS is 1-indexed)
    // Col 1: Request Id, Col 2: Mubasher No, Col 3: Customer Name, Col 4: Order Side
    // Col 5: Symbol, Col 6: Symbol Description, Col 10: Quantity, Col 11: Price, Col 12: Order Value
    const requestId = String(row.getCell(1).value || `REQ-${rowNumber}`).trim();
    const mubasherNo = String(row.getCell(2).value || '').trim();
    const customerName = String(row.getCell(3).value || '').trim();
    const orderSide = String(row.getCell(4).value || '').trim();
    const symbol = String(row.getCell(5).value || '').trim();
    const symbolDescription = String(row.getCell(6).value || symbol).trim();
    const quantity = Number(row.getCell(10).value) || 0;
    const price = Number(row.getCell(11).value) || 0;
    const orderValue = Number(row.getCell(12).value) || 0;
    const isinCode = String(row.getCell(18).value || '').trim();
    const rawDate = row.getCell(26).value; // Order Date

    let orderDate = new Date().toISOString();
    if (rawDate instanceof Date) {
      orderDate = rawDate.toISOString();
    } else if (typeof rawDate === 'string' && rawDate) {
      orderDate = new Date(rawDate).toISOString();
    }

    if (requestId && symbol) {
      rows.push({
        id: `tx-${rowNumber}-${Date.now()}`,
        fileId,
        requestId,
        mubasherNo,
        customerName,
        orderSide,
        symbol,
        symbolDescription,
        quantity,
        price,
        orderValue,
        isinCode,
        orderDate,
      });
    }
  });

  return rows;
}

/**
 * Generates an Excel workbook with sheets per Product sorted alphabetically,
 * reproducing the exact logic of VBA Sub ExportPerProduct_PerSheet_FromF_Alphabetical.
 */
export async function exportTransactionSheetsPerProduct(
  rows: GeneratedTransactionRow[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Investment Management Platform';

  // Group rows by product name (Symbol Description / Column F)
  const productMap = new Map<string, GeneratedTransactionRow[]>();
  for (const row of rows) {
    const prod = row.productName.trim() || 'Uncategorized';
    if (!productMap.has(prod)) {
      productMap.set(prod, []);
    }
    productMap.get(prod)!.push(row);
  }

  // Sort product keys alphabetically (matches VBA QuickSort)
  const sortedProducts = Array.from(productMap.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  for (const prodKey of sortedProducts) {
    // Truncate to 31 chars safe name for sheet tab (VBA safeName)
    const safeSheetName = prodKey.substring(0, 31).replace(/[\/*?:[\]]/g, '_');
    const ws = workbook.addWorksheet(safeSheetName);

    // Set 11 Target Headers (VBA Header Columns A-K)
    ws.addRow([
      'Transaction ID',
      'Transaction Type',
      'Transaction Date',
      'External Code',
      'Name',
      'Transaction Value',
      'Qty',
      'Branch ID',
      'Value Date',
      'IC Price',
      'Fees',
    ]);

    // Header styling
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1E293B' },
    };

    const prodRows = productMap.get(prodKey)!;
    for (const item of prodRows) {
      ws.addRow([
        item.transactionId,
        item.transactionType,
        item.transactionDate,
        item.externalCode,
        item.name,
        item.transactionValue !== null ? item.transactionValue : '',
        item.qty !== null ? item.qty : '',
        item.branchId,
        item.valueDate,
        item.icPrice,
        item.fees,
      ]);
    }

    // Auto-fit column widths
    ws.columns.forEach((col) => {
      let maxLen = 12;
      col.eachCell!({ includeEmpty: true }, (cell) => {
        const valStr = cell.value ? String(cell.value) : '';
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      col.width = Math.min(maxLen + 4, 40);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Generates an Excel Netting / Transfer Sheet matching Screenshot 1 visual layout.
 */
export async function exportNettingSheet(
  nettingRows: NettingRow[],
  totalBuy: number,
  totalSell: number,
  totalNet: number
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Netting Transfer Sheet');

  // Headers
  ws.addRow(['Symbol Code', 'Symbol Name', 'Actual Symbol', 'Buy', 'Sell', 'NET']);

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '0F172A' },
  };

  for (const row of nettingRows) {
    const netFormatted = formatFinancialNumber(row.netAmount);
    const addedRow = ws.addRow([
      row.symbolCode,
      row.symbolName,
      row.actualSymbol,
      row.buyTotal > 0 ? row.buyTotal : '-',
      row.sellTotal > 0 ? row.sellTotal : '-',
      netFormatted,
    ]);

    const netCell = addedRow.getCell(6);
    if (row.status === 'POSITIVE') {
      netCell.font = { color: { argb: '059669' }, bold: true };
    } else if (row.status === 'NEGATIVE') {
      netCell.font = { color: { argb: 'DC2626' }, bold: true };
    }
  }

  // Summary row
  const summaryRow = ws.addRow([
    'TOTAL SUMMARY',
    '',
    '',
    totalBuy,
    totalSell,
    formatFinancialNumber(totalNet),
  ]);
  summaryRow.font = { bold: true };
  summaryRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'F1F5F9' },
  };

  ws.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
