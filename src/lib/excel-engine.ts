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

function extractCellValue(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) return '';
  if (cell.value instanceof Date) return cell.value.toISOString();
  if (typeof cell.value === 'object') {
    if ('result' in cell.value && cell.value.result !== undefined && cell.value.result !== null) {
      return String(cell.value.result).trim();
    }
    if ('text' in cell.value && cell.value.text !== undefined) {
      return String(cell.value.text).trim();
    }
    if ('richText' in cell.value && Array.isArray((cell.value as { richText: unknown[] }).richText)) {
      return (cell.value as { richText: { text: string }[] }).richText
        .map((rt) => rt.text)
        .join('')
        .trim();
    }
  }
  return String(cell.value).trim();
}

function extractNumericValue(cell: ExcelJS.Cell): number {
  const rawStr = extractCellValue(cell);
  if (!rawStr) return 0;
  const cleaned = rawStr.replace(/,/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parses raw trading Excel file into RawTransactionRow objects.
 */
export async function parseTradingExcel(file: File): Promise<RawTransactionRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet || worksheet.rowCount <= 1) {
    throw new Error('Workbook contains no data rows.');
  }

  let colRequestId = 1;
  let colMubasherNo = 2;
  let colCustomerName = 3;
  let colOrderSide = 4;
  let colSymbol = 5;
  let colSymbolDesc = 6;
  let colQuantity = 10;
  let colPrice = 11;
  let colOrderValue = 12;
  let colIsinCode = 18;
  let colOrderDate = 25;

  const headerRow = worksheet.getRow(1);
  let foundHeaders = false;

  headerRow.eachCell((cell, colNumber) => {
    const text = extractCellValue(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!text) return;

    if (text === 'requestid' || text === 'reqid' || text === 'request') {
      colRequestId = colNumber;
      foundHeaders = true;
    } else if (text === 'mubasherno' || text === 'mubasher' || text === 'externalcode') {
      colMubasherNo = colNumber;
      foundHeaders = true;
    } else if (text === 'customername' || text === 'customer' || text === 'clientname' || text === 'name') {
      colCustomerName = colNumber;
      foundHeaders = true;
    } else if (text === 'orderside' || text === 'side' || text === 'transactiontype') {
      colOrderSide = colNumber;
      foundHeaders = true;
    } else if (text === 'symbol' || text === 'symbolcode' || text === 'sym') {
      colSymbol = colNumber;
      foundHeaders = true;
    } else if (text === 'symboldescription' || text === 'description' || text === 'product' || text === 'productname' || text === 'fundname') {
      colSymbolDesc = colNumber;
      foundHeaders = true;
    } else if (text === 'quantity' || text === 'qty') {
      colQuantity = colNumber;
      foundHeaders = true;
    } else if (text === 'price' || text === 'icprice') {
      colPrice = colNumber;
      foundHeaders = true;
    } else if (text === 'ordervalue' || text === 'value' || text === 'transactionvalue' || text === 'amount') {
      colOrderValue = colNumber;
      foundHeaders = true;
    } else if (text === 'isincode' || text === 'isin') {
      colIsinCode = colNumber;
      foundHeaders = true;
    } else if (text === 'orderdate' || text === 'date' || text === 'transactiondate') {
      colOrderDate = colNumber;
      foundHeaders = true;
    }
  });

  const rows: RawTransactionRow[] = [];
  const fileId = `file-${Date.now()}`;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 && foundHeaders) return;

    const requestId = extractCellValue(row.getCell(colRequestId)) || `REQ-${rowNumber}`;
    const mubasherNo = extractCellValue(row.getCell(colMubasherNo));
    const customerName = extractCellValue(row.getCell(colCustomerName));
    const rawOrderSide = extractCellValue(row.getCell(colOrderSide));
    const symbol = extractCellValue(row.getCell(colSymbol));
    const symbolDescription = extractCellValue(row.getCell(colSymbolDesc));
    const quantity = extractNumericValue(row.getCell(colQuantity));
    const price = extractNumericValue(row.getCell(colPrice));
    const orderValue = extractNumericValue(row.getCell(colOrderValue));
    const isinCode = extractCellValue(row.getCell(colIsinCode));
    const orderDateRaw = extractCellValue(row.getCell(colOrderDate));

    const effectiveSymbol = symbol || symbolDescription || `SYM-${rowNumber}`;
    const effectiveDescription = symbolDescription || symbol || effectiveSymbol;

    let orderSide = rawOrderSide.toUpperCase();
    if (!orderSide || (!orderSide.includes('BUY') && !orderSide.includes('SELL'))) {
      orderSide = 'BUY';
    } else if (orderSide.includes('BUY')) {
      orderSide = 'BUY';
    } else if (orderSide.includes('SELL')) {
      orderSide = 'SELL';
    }

    if (requestId || effectiveSymbol || orderValue > 0) {
      rows.push({
        id: `tx-${rowNumber}-${Date.now()}`,
        fileId,
        requestId,
        mubasherNo: mubasherNo || `EXT-${rowNumber}`,
        customerName: customerName || 'Valued Investor',
        orderSide,
        symbol: effectiveSymbol,
        symbolDescription: effectiveDescription,
        quantity: quantity || (price > 0 ? Math.round(orderValue / price) : 1),
        price: price || (quantity > 0 ? orderValue / quantity : 0),
        orderValue: orderValue || quantity * price,
        isinCode,
        orderDate: orderDateRaw || new Date().toISOString(),
      });
    }
  });

  return rows;
}

/**
 * Generates an Excel workbook containing ONLY a single selected Fund's transaction sheet.
 */
export async function exportSingleFundTransactionSheet(
  allRows: GeneratedTransactionRow[],
  productName: string
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Investment Management Platform';

  const fundRows = allRows.filter((r) => r.productName === productName);
  const safeSheetName = productName.substring(0, 31).replace(/[\/*?:[\]]/g, '_');
  const ws = workbook.addWorksheet(safeSheetName || 'Fund Sheet');

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

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '059669' },
  };

  for (const item of fundRows) {
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

  ws.columns.forEach((col) => {
    let maxLen = 12;
    col.eachCell!({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? String(cell.value) : '';
      if (valStr.length > maxLen) maxLen = valStr.length;
    });
    col.width = Math.min(maxLen + 4, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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

  const productMap = new Map<string, GeneratedTransactionRow[]>();
  for (const row of rows) {
    const prod = row.productName.trim() || 'Uncategorized';
    if (!productMap.has(prod)) {
      productMap.set(prod, []);
    }
    productMap.get(prod)!.push(row);
  }

  const sortedProducts = Array.from(productMap.keys()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  for (const prodKey of sortedProducts) {
    const safeSheetName = prodKey.substring(0, 31).replace(/[\/*?:[\]]/g, '_');
    const ws = workbook.addWorksheet(safeSheetName);

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

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '059669' },
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
