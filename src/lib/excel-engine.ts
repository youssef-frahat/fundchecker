// Excel Ingestion & Export Engine - ExcelJS Powered Pipeline

import ExcelJS from 'exceljs';
import { GeneratedTransactionRow, NettingRow, RawTransactionRow, TransferSheetLine } from './types';
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
 * Intelligently scans the first 10 rows to detect the exact header row.
 */
export async function parseTradingExcel(file: File): Promise<RawTransactionRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error('Workbook contains no worksheets.');
  }

  // Intelligently scan ALL worksheets to find the one containing raw trade data
  let targetWorksheet: ExcelJS.Worksheet = workbook.worksheets[0];
  let highestScore = -1;
  let bestHeaderRow = 1;
  let bestCols = {
    colRequestId: 1,
    colMubasherNo: 2,
    colCustomerName: 3,
    colOrderSide: 4,
    colSymbol: 5,
    colSymbolDesc: 6,
    colOrderStatus: 7,
    colQuantity: 10,
    colPrice: 11,
    colOrderValue: 12,
    colIsinCode: 18,
    colOrderDate: 25,
    colAllocatedQuantity: 35,
  };

  for (const ws of workbook.worksheets) {
    if (ws.rowCount <= 1) continue;

    for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
      const row = ws.getRow(r);
      let matchScore = 0;
      const currentCols = { ...bestCols };

      row.eachCell((cell, colNumber) => {
        const text = extractCellValue(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!text) return;

        // Skip audit/secondary workflow columns from overtaking primary trade columns
        if (text.includes('original')) return;

        if (text === 'requestid' || text === 'reqid' || text === 'orderid' || text === 'trid' || text === 'transactionid') {
          currentCols.colRequestId = colNumber;
          matchScore += 5;
        } else if (text.includes('request') && !currentCols.colRequestId) {
          currentCols.colRequestId = colNumber;
          matchScore += 3;
        } else if (text === 'orderstatus' || text === 'status') {
          currentCols.colOrderStatus = colNumber;
          matchScore += 2;
        } else if (text.includes('allocated') && (text.includes('quantity') || text.includes('qty'))) {
          currentCols.colAllocatedQuantity = colNumber;
          matchScore += 3;
        } else if (text.includes('mubasher') || text.includes('externalcode') || text.includes('customerno')) {
          currentCols.colMubasherNo = colNumber;
          matchScore += 3;
        } else if (text.includes('customer') || text.includes('client') || text === 'name') {
          currentCols.colCustomerName = colNumber;
          matchScore += 3;
        } else if (text.includes('side') || text.includes('orderside') || text.includes('type') || text === 'action') {
          currentCols.colOrderSide = colNumber;
          matchScore += 4;
        } else if (text === 'symbol' || text === 'symbolcode' || text === 'sym' || text === 'fund') {
          currentCols.colSymbol = colNumber;
          matchScore += 5;
        } else if (text.includes('symboldescription') || text.includes('product') || text.includes('fundname') || text.includes('description')) {
          currentCols.colSymbolDesc = colNumber;
          matchScore += 4;
        } else if (text === 'quantity' || text === 'qty' || text.includes('netholdings')) {
          currentCols.colQuantity = colNumber;
          matchScore += 4;
        } else if (text.includes('quantity') && !currentCols.colQuantity) {
          currentCols.colQuantity = colNumber;
          matchScore += 2;
        } else if (text.includes('price') || text.includes('icprice') || text.includes('avgcost')) {
          currentCols.colPrice = colNumber;
          matchScore += 3;
        } else if (text.includes('ordervalue') || text.includes('netsettle') || text.includes('amount') || text.includes('value')) {
          currentCols.colOrderValue = colNumber;
          matchScore += 4;
        } else if (text.includes('isin')) {
          currentCols.colIsinCode = colNumber;
          matchScore += 2;
        } else if (text === 'orderdate' || (text.includes('date') && !text.includes('accepted') && !text.includes('reviewed') && !text.includes('approved') && !text.includes('cancelled') && !text.includes('updated'))) {
          currentCols.colOrderDate = colNumber;
          matchScore += 3;
        }
      });

      // Weight score by row count to strongly prefer data sheets over tiny pivot tables
      const finalScore = matchScore * (ws.rowCount > 10 ? 2 : 1);
      if (finalScore > highestScore && matchScore >= 4) {
        highestScore = finalScore;
        targetWorksheet = ws;
        bestHeaderRow = r;
        bestCols = { ...currentCols };
      }
    }
  }

  const worksheet = targetWorksheet;
  const headerRowNumber = bestHeaderRow;
  const foundHeaders = highestScore > 0;
  const {
    colRequestId,
    colMubasherNo,
    colCustomerName,
    colOrderSide,
    colSymbol,
    colSymbolDesc,
    colOrderStatus,
    colQuantity,
    colPrice,
    colOrderValue,
    colIsinCode,
    colOrderDate,
    colAllocatedQuantity,
  } = bestCols;

  const rows: RawTransactionRow[] = [];
  const fileId = `file-${Date.now()}`;

  worksheet.eachRow((row, rowNumber) => {
    // Skip header row and any preceding title rows
    if (foundHeaders && rowNumber <= headerRowNumber) return;
    if (!foundHeaders && rowNumber === 1) return;

    const requestId = extractCellValue(row.getCell(colRequestId)) || '';
    const mubasherNo = extractCellValue(row.getCell(colMubasherNo));

    const customerName = extractCellValue(row.getCell(colCustomerName));
    const rawOrderSide = extractCellValue(row.getCell(colOrderSide));
    const rawSymbol = extractCellValue(row.getCell(colSymbol));
    const rawSymbolDesc = extractCellValue(row.getCell(colSymbolDesc));
    const rawOrderStatus = colOrderStatus ? extractCellValue(row.getCell(colOrderStatus)) : '';
    const quantity = extractNumericValue(row.getCell(colQuantity));
    const price = extractNumericValue(row.getCell(colPrice));
    const orderValue = extractNumericValue(row.getCell(colOrderValue));
    const isinCode = extractCellValue(row.getCell(colIsinCode));
    const orderDateRaw = extractCellValue(row.getCell(colOrderDate));
    const allocatedQuantity = colAllocatedQuantity ? extractNumericValue(row.getCell(colAllocatedQuantity)) : 0;

    // Intelligent symbol and description resolution
    const effectiveSymbol = rawSymbol || rawSymbolDesc || 'UNKNOWN_SYMBOL';
    const effectiveDescription = rawSymbolDesc || rawSymbol || effectiveSymbol;

    // Ignore header re-occurrences or total rows
    if (effectiveSymbol.toLowerCase().includes('symbol') || customerName.toLowerCase().includes('total')) {
      return;
    }

    let orderSide = rawOrderSide.toUpperCase();
    if (!orderSide || (!orderSide.includes('BUY') && !orderSide.includes('SELL'))) {
      orderSide = 'BUY';
    } else if (orderSide.includes('BUY')) {
      orderSide = 'BUY';
    } else if (orderSide.includes('SELL')) {
      orderSide = 'SELL';
    }

    if (requestId || effectiveSymbol !== 'UNKNOWN_SYMBOL' || orderValue > 0) {
      rows.push({
        id: `tx-${rowNumber}-${Date.now()}`,
        fileId,
        // Keep raw values — downstream allocationEngine validation rejects missing fields
        requestId,
        mubasherNo: mubasherNo || '',
        customerName: customerName || '',
        orderSide,
        symbol: effectiveSymbol,
        symbolDescription: effectiveDescription,
        orderStatus: rawOrderStatus,
        allocatedQuantity: allocatedQuantity > 0 ? allocatedQuantity : quantity,
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

export async function exportSingleFundTransactionSheet(
  allRows: GeneratedTransactionRow[],
  productName: string,
  forceCompleteData: boolean = false
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Investment Management Platform';

  const targetName = productName.trim().toLowerCase();
  const fundRows = allRows.filter((r) => r.productName.trim().toLowerCase() === targetName);
  const safeSheetName = (productName.trim() || 'Fund Sheet').substring(0, 31).replace(/[\/*?:[\]]/g, '_');
  const ws = workbook.addWorksheet(safeSheetName || 'Fund Sheet');
  ws.views = [{ showGridLines: true }];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  ws.columns = [
    { header: 'Transaction ID', key: 'transactionId', width: 22 },
    { header: 'Transaction Type', key: 'transactionType', width: 16 },
    { header: 'Transaction Date', key: 'transactionDate', width: 16 },
    { header: 'External Code', key: 'externalCode', width: 18 },
    { header: 'Name', key: 'name', width: 34 },
    { header: 'Transaction Value', key: 'transactionValue', width: 20 },
    { header: 'Qty', key: 'qty', width: 14 },
    { header: 'Branch ID', key: 'branchId', width: 12 },
    { header: 'Value Date', key: 'valueDate', width: 16 },
    { header: 'IC Price', key: 'icPrice', width: 14 },
    { header: 'Fees', key: 'fees', width: 10 },
  ];

  // Header row matching media_1788005857699.png (Vivid Yellow #FFFF00, bold black, black borders)
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.eachCell((cell) => { cell.border = thinBorder; });

  for (const item of fundRows) {
    const val = item.transactionValue !== null
      ? item.transactionValue
      : (forceCompleteData && item.qty !== null && item.icPrice ? item.qty * item.icPrice : '');

    const quantity = item.qty !== null
      ? item.qty
      : (forceCompleteData && item.transactionValue !== null && item.icPrice ? item.transactionValue / item.icPrice : '');

    const addedRow = ws.addRow({
      transactionId: item.transactionId,
      transactionType: item.transactionType.toLowerCase(), // lowercase 'buy' / 'sell'
      transactionDate: item.transactionDate,
      externalCode: item.externalCode,
      name: item.name,
      transactionValue: val,
      qty: quantity,
      branchId: item.branchId,
      valueDate: item.valueDate,
      icPrice: item.icPrice,
      fees: item.fees,
    });

    addedRow.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10 };
      if ([1, 2, 3, 4, 8, 9, 11].includes(colNumber)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if ([6, 7, 10].includes(colNumber)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber === 6 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        if (colNumber === 7 && typeof cell.value === 'number') cell.numFmt = '#,##0';
        if (colNumber === 10 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export async function exportTransactionSheetsPerProduct(
  rows: GeneratedTransactionRow[],
  forceCompleteData: boolean = false
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

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  for (const prodKey of sortedProducts) {
    const safeSheetName = prodKey.substring(0, 31).replace(/[\/*?:[\]]/g, '_');
    const ws = workbook.addWorksheet(safeSheetName);
    ws.views = [{ showGridLines: true }];

    ws.columns = [
      { header: 'Transaction ID', key: 'transactionId', width: 22 },
      { header: 'Transaction Type', key: 'transactionType', width: 16 },
      { header: 'Transaction Date', key: 'transactionDate', width: 16 },
      { header: 'External Code', key: 'externalCode', width: 18 },
      { header: 'Name', key: 'name', width: 34 },
      { header: 'Transaction Value', key: 'transactionValue', width: 20 },
      { header: 'Qty', key: 'qty', width: 14 },
      { header: 'Branch ID', key: 'branchId', width: 12 },
      { header: 'Value Date', key: 'valueDate', width: 16 },
      { header: 'IC Price', key: 'icPrice', width: 14 },
      { header: 'Fees', key: 'fees', width: 10 },
    ];

    // Header row matching media_1788005857699.png (Vivid Yellow #FFFF00, bold black, black borders)
    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => { cell.border = thinBorder; });

    const prodRows = productMap.get(prodKey)!;
    for (const item of prodRows) {
      const val = item.transactionValue !== null
        ? item.transactionValue
        : (forceCompleteData && item.qty !== null && item.icPrice ? item.qty * item.icPrice : '');

      const quantity = item.qty !== null
        ? item.qty
        : (forceCompleteData && item.transactionValue !== null && item.icPrice ? item.transactionValue / item.icPrice : '');

      const addedRow = ws.addRow({
        transactionId: item.transactionId,
        transactionType: item.transactionType.toLowerCase(), // lowercase 'buy' / 'sell'
        transactionDate: item.transactionDate,
        externalCode: item.externalCode,
        name: item.name,
        transactionValue: val,
        qty: quantity,
        branchId: item.branchId,
        valueDate: item.valueDate,
        icPrice: item.icPrice,
        fees: item.fees,
      });

      addedRow.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { name: 'Calibri', size: 10 };
        if ([1, 2, 3, 4, 8, 9, 11].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([6, 7, 10].includes(colNumber)) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 6 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
          if (colNumber === 7 && typeof cell.value === 'number') cell.numFmt = '#,##0';
          if (colNumber === 10 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Packages each fund into its own separate standalone Excel file (.xlsx) with yellow headers,
 * and bundles all files into a single ZIP archive (.zip).
 * For T0 funds, both Value and Quantity are fully preserved (بيانات كاملة).
 */
export async function exportAllFundsAsZip(
  rows: GeneratedTransactionRow[],
  forceCompleteData: boolean = false
): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

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

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  for (const prodKey of sortedProducts) {
    const fundRows = productMap.get(prodKey) || [];
    if (fundRows.length === 0) continue;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Investment Management Platform';
    const safeSheetName = prodKey.substring(0, 31).replace(/[\/*?:[\]]/g, '_');
    const ws = workbook.addWorksheet(safeSheetName);
    ws.views = [{ showGridLines: true }];

    ws.columns = [
      { header: 'Transaction ID', key: 'transactionId', width: 22 },
      { header: 'Transaction Type', key: 'transactionType', width: 16 },
      { header: 'Transaction Date', key: 'transactionDate', width: 16 },
      { header: 'External Code', key: 'externalCode', width: 18 },
      { header: 'Name', key: 'name', width: 34 },
      { header: 'Transaction Value', key: 'transactionValue', width: 20 },
      { header: 'Qty', key: 'qty', width: 14 },
      { header: 'Branch ID', key: 'branchId', width: 12 },
      { header: 'Value Date', key: 'valueDate', width: 16 },
      { header: 'IC Price', key: 'icPrice', width: 14 },
      { header: 'Fees', key: 'fees', width: 10 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }; // Vivid Yellow
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => { cell.border = thinBorder; });

    for (const item of fundRows) {
      const val = item.transactionValue !== null
        ? item.transactionValue
        : (forceCompleteData && item.qty !== null && item.icPrice ? item.qty * item.icPrice : '');

      const quantity = item.qty !== null
        ? item.qty
        : (forceCompleteData && item.transactionValue !== null && item.icPrice ? item.transactionValue / item.icPrice : '');

      const addedRow = ws.addRow({
        transactionId: item.transactionId,
        transactionType: item.transactionType.toLowerCase(),
        transactionDate: item.transactionDate,
        externalCode: item.externalCode,
        name: item.name,
        transactionValue: val,
        qty: quantity,
        branchId: item.branchId,
        valueDate: item.valueDate,
        icPrice: item.icPrice,
        fees: item.fees,
      });

      addedRow.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { name: 'Calibri', size: 10 };
        if ([1, 2, 3, 4, 8, 9, 11].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([6, 7, 10].includes(colNumber)) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 6 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
          if (colNumber === 7 && typeof cell.value === 'number') cell.numFmt = '#,##0';
          if (colNumber === 10 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    }

    const fileBuffer = await workbook.xlsx.writeBuffer();
    const safeFileName = prodKey.replace(/[^a-zA-Z0-9_\u0600-\u06FF\s-]/g, '').trim().replace(/\s+/g, '_') || 'Fund';
    zip.file(`${safeFileName}.xlsx`, fileBuffer);
  }

  return await zip.generateAsync({ type: 'blob' });
}

export async function exportNettingSheet(
  nettingRows: NettingRow[],
  totalBuy: number,
  totalSell: number,
  totalNet: number
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Netting Transfer Sheet');
  ws.views = [{ showGridLines: true }];

  ws.columns = [
    { header: 'Symbol Code', key: 'symbolCode', width: 22 },
    { header: 'Symbol Name', key: 'symbolName', width: 34 },
    { header: 'Actual Symbol', key: 'actualSymbol', width: 24 },
    { header: 'Buy', key: 'buy', width: 18 },
    { header: 'Sell', key: 'sell', width: 18 },
    { header: 'NET', key: 'net', width: 20 },
    { header: '', key: 'sep', width: 4 },
    { header: '', key: 'notes', width: 35 },
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  };

  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
  for (let c = 1; c <= 6; c++) {
    headerRow.getCell(c).border = headerBorder;
  }

  // Exact matching media_1788005938657.png
  nettingRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const addedRow = ws.addRow({
      symbolCode: row.symbolCode,
      symbolName: row.symbolName,
      actualSymbol: row.actualSymbol,
      buy: row.buyTotal > 0 ? row.buyTotal : '-',
      sell: row.sellTotal > 0 ? row.sellTotal : '-',
      net: row.netAmount !== 0 ? row.netAmount : '-',
    });

    addedRow.height = 20;

    for (let c = 1; c <= 6; c++) {
      const cell = addedRow.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10 };

      if (c <= 3) cell.alignment = { horizontal: 'left', vertical: 'middle' };
      if (c === 4 || c === 5) {
        if (typeof cell.value === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
      if (c === 6) {
        if (typeof cell.value === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00;(#,##0.00);"-"';
          if (cell.value > 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF006100' } };
          } else if (cell.value < 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
            cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF9C0006' } };
          }
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
    }

    if (rowNumber === 11) {
      const noteCell = addedRow.getCell(8);
      noteCell.value = 'تحويلات دولار';
      noteCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1F4E79' } };
      noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
    if (rowNumber === 13) {
      const noteCell = addedRow.getCell(8);
      noteCell.value = 'مجموع العمليات يرجي توضيح التنسيق المطلوب للارسال';
      noteCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF595959' } };
      noteCell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  const summaryRow = ws.addRow({
    symbolCode: 'TOTAL SUMMARY',
    symbolName: '',
    actualSymbol: '',
    buy: totalBuy,
    sell: totalSell,
    net: totalNet,
  });
  summaryRow.height = 24;
  summaryRow.font = { name: 'Calibri', size: 11, bold: true };
  summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  for (let c = 1; c <= 6; c++) {
    const cell = summaryRow.getCell(c);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
    if (c === 4 || c === 5) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00';
    }
    if (c === 6) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00;(#,##0.00);"-"';
      if (totalNet > 0) {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF006100' } };
      } else if (totalNet < 0) {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9C0006' } };
      }
    }
  }

  ws.columns.forEach((col) => {
    col.width = 22;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Exports the Netting Cash Transfer Sheet as a beautifully formatted Excel file (.xlsx)
 * matching the UI visual styling:
 * - Transfer / Sell (تحويل): RED background (#FFEBEE) and bold red text (#B71C1C)
 * - Receive / Buy (استقبال): GREEN background (#E8F5E9) and bold green text (#1B5E20)
 * - System Net Transfer and Final Transfer styled with Red / Green indicators
 * - Adjustments highlighted in soft Amber (#FFF9C4 / #F57F17)
 * - Bold summary totals row with double bottom border
 */
export async function exportTransferSheetBatchExcel(
  lines: TransferSheetLine[],
  batchNumber: string = 'Batch'
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Investment Operations Platform';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Cash Netting & Transfers');
  ws.views = [{ showGridLines: true }];

  ws.columns = [
    { header: 'Symbol Code', key: 'symbolCode', width: 16 },
    { header: 'Fund Name', key: 'symbolName', width: 34 },
    { header: 'Actual Symbol', key: 'actualSymbol', width: 20 },
    { header: 'System Buy (استقبال)', key: 'systemBuy', width: 22 },
    { header: 'System Sell (تحويل)', key: 'systemSell', width: 22 },
    { header: 'System Net (Sell - Buy)', key: 'systemNet', width: 24 },
    { header: 'Adjustment Amount', key: 'adjustment', width: 20 },
    { header: 'Final Transfer Amount', key: 'finalTransfer', width: 24 },
    { header: 'Transfer Action', key: 'action', width: 26 },
  ];

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
    right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
  };

  const headerBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'medium', color: { argb: 'FF000000' } },
    bottom: { style: 'medium', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };

  const headerRow = ws.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  for (let c = 1; c <= 9; c++) {
    headerRow.getCell(c).border = headerBorder;
  }

  let totalBuy = 0;
  let totalSell = 0;
  let totalNet = 0;
  let totalAdjustment = 0;
  let totalFinal = 0;

  lines.forEach((line) => {
    totalBuy += line.systemBuyAmount || 0;
    totalSell += line.systemSellAmount || 0;
    totalNet += line.systemNetAmount || 0;
    totalAdjustment += line.adjustmentAmount || 0;
    totalFinal += line.finalTransferAmount || 0;

    const isTransfer = line.finalTransferAmount > 0;
    const isReceive = line.finalTransferAmount < 0;
    const actionText = isTransfer
      ? 'تحويل من الصندوق (Transfer)'
      : isReceive
      ? 'استقبال للصندوق (Receive)'
      : 'لا يوجد تحويل (Zero)';

    const addedRow = ws.addRow({
      symbolCode: line.symbolCode,
      symbolName: line.symbolName,
      actualSymbol: line.actualSymbol || '—',
      systemBuy: line.systemBuyAmount,
      systemSell: line.systemSellAmount,
      systemNet: line.systemNetAmount,
      adjustment: line.adjustmentAmount || 0,
      finalTransfer: line.finalTransferAmount,
      action: actionText,
    });

    addedRow.height = 22;

    for (let c = 1; c <= 9; c++) {
      const cell = addedRow.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10 };

      // Col 1-3: Identifiers
      if (c <= 3) {
        cell.alignment = { horizontal: c === 1 ? 'center' : 'left', vertical: 'middle' };
        if (c === 1) cell.font = { name: 'Calibri', size: 10, bold: true };
      }

      // Col 4: Buy (استقبال) -> Soft Green styling
      if (c === 4) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
        if (line.systemBuyAmount > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1B5E20' } };
        }
      }

      // Col 5: Sell (تحويل) -> Soft Red styling
      if (c === 5) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
        if (line.systemSellAmount > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB71C1C' } };
        }
      }

      // Col 6: System Net Transfer
      if (c === 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        if (line.systemNetAmount > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFC62828' } };
        } else if (line.systemNetAmount < 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF2E7D32' } };
        }
      }

      // Col 7: Adjustment
      if (c === 7) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        if (line.adjustmentAmount !== 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFF57F17' } };
        }
      }

      // Col 8: Final Transfer Amount
      if (c === 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00;(#,##0.00);"-"';
        if (line.finalTransferAmount > 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB71C1C' } };
        } else if (line.finalTransferAmount < 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };
          cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1B5E20' } };
        }
      }

      // Col 9: Action
      if (c === 9) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (isTransfer) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFB71C1C' } };
        } else if (isReceive) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1B5E20' } };
        }
      }
    }
  });

  // Summary Row
  const summaryRow = ws.addRow({
    symbolCode: 'TOTAL SUMMARY',
    symbolName: `Count: ${lines.length} Funds`,
    actualSymbol: '',
    systemBuy: totalBuy,
    systemSell: totalSell,
    systemNet: totalNet,
    adjustment: totalAdjustment,
    finalTransfer: totalFinal,
    action: totalFinal > 0 ? 'NET TRANSFER (تحويل)' : 'NET RECEIVE (استقبال)',
  });
  summaryRow.height = 26;
  summaryRow.font = { name: 'Calibri', size: 11, bold: true };
  summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

  for (let c = 1; c <= 9; c++) {
    const cell = summaryRow.getCell(c);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
    if (c >= 4 && c <= 8) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.numFmt = '#,##0.00;(#,##0.00);"-"';
      if (c === 4) cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1B5E20' } };
      if (c === 5) cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFB71C1C' } };
      if (c === 8) {
        cell.font = {
          name: 'Calibri',
          size: 12,
          bold: true,
          color: { argb: totalFinal > 0 ? 'FFB71C1C' : 'FF1B5E20' },
        };
      }
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
