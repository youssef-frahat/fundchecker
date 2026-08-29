// Transaction Generator - Real Excel Generation + Storage Upload + DB Report Record
// REMEDIATION TX-1: Actual ExcelJS workbook built and uploaded to Supabase Storage
// REMEDIATION TX-2: Throws on DB insert failure (no silent swallowing)

import ExcelJS from 'exceljs';
import { supabase } from '../supabase';
import { GeneratedTransactionRow } from '../types';
import { uploadReportToStorage } from './storageService';

export interface GroupedTransactionOutput {
  productName: string;
  rows: GeneratedTransactionRow[];
  totalValue: number;
  totalQuantity: number;
}

export interface TransactionGeneratorResult {
  groupedOutputs: GroupedTransactionOutput[];
  totalProductsCount: number;
  totalGeneratedRows: number;
  reportId?: string;
  storagePath?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Generates fund transaction Excel workbook, uploads to Supabase Storage (private bucket),
 * and persists a generated_reports DB record with the real storage path.
 */
export async function generateFundTransactions(
  fileId: string,
  generatedRows: GeneratedTransactionRow[],
  userId?: string
): Promise<TransactionGeneratorResult> {
  // Group rows by product (fund)
  const productMap = new Map<string, GeneratedTransactionRow[]>();

  for (const row of generatedRows) {
    const prod = row.productName.trim() || 'Uncategorized Product';
    if (!productMap.has(prod)) {
      productMap.set(prod, []);
    }
    productMap.get(prod)!.push(row);
  }

  const groupedOutputs: GroupedTransactionOutput[] = [];

  for (const [productName, rows] of productMap.entries()) {
    const totalValue = rows.reduce((acc, r) => acc + (r.transactionValue || 0), 0);
    const totalQuantity = rows.reduce((acc, r) => acc + (r.qty || 0), 0);
    groupedOutputs.push({
      productName,
      rows,
      totalValue: Math.round(totalValue * 10000) / 10000,
      totalQuantity: Math.round(totalQuantity * 10000) / 10000,
    });
  }

  groupedOutputs.sort((a, b) => a.productName.localeCompare(b.productName));

  // TX-1: BUILD ACTUAL EXCEL WORKBOOK
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Investment Operations Platform';
  workbook.created = new Date();

  const HEADER_COLUMNS = [
    { header: 'Transaction ID', key: 'transactionId', width: 20 },
    { header: 'Type', key: 'transactionType', width: 10 },
    { header: 'Date', key: 'transactionDate', width: 14 },
    { header: 'External Code', key: 'externalCode', width: 18 },
    { header: 'Customer Name', key: 'name', width: 30 },
    { header: 'Transaction Value', key: 'transactionValue', width: 20 },
    { header: 'Quantity', key: 'qty', width: 16 },
    { header: 'Branch ID', key: 'branchId', width: 12 },
    { header: 'Value Date', key: 'valueDate', width: 14 },
    { header: 'IC Price', key: 'icPrice', width: 14 },
    { header: 'Fees', key: 'fees', width: 10 },
  ];

  for (const group of groupedOutputs) {
    // Sanitize sheet name (Excel tab limit: 31 chars, no special chars)
    const sheetName = group.productName.replace(/[\\\/\?\*\[\]:]/g, '').substring(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    sheet.columns = HEADER_COLUMNS;

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };

    // Style header row to EXACTLY match user reference screenshot (media_1788005857699.png):
    // Vivid Yellow background (#FFFF00), bold black text, centered, solid thin black borders
    const headerRow = sheet.getRow(1);
    headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.border = thinBorder;
    });

    // Add data rows matching media_1788005857699.png
    for (const row of group.rows) {
      const addedRow = sheet.addRow({
        transactionId: row.transactionId,
        transactionType: row.transactionType.toLowerCase(), // lowercase 'buy' / 'sell' as in screenshot
        transactionDate: row.transactionDate,
        externalCode: row.externalCode,
        name: row.name,
        transactionValue: row.transactionValue !== null ? row.transactionValue : '',
        qty: row.qty !== null ? row.qty : '',
        branchId: row.branchId,
        valueDate: row.valueDate,
        icPrice: row.icPrice,
        fees: row.fees,
      });

      addedRow.eachCell((cell, colNumber) => {
        cell.border = thinBorder;
        cell.font = { name: 'Calibri', size: 10 };
        // Center-align dates, IDs, codes, types
        if ([1, 2, 3, 4, 8, 9, 11].includes(colNumber)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([6, 7, 10].includes(colNumber)) {
          // Right-align financial numbers
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (colNumber === 6 && typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
          } else if (colNumber === 7 && typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
          } else if (colNumber === 10 && typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
          }
        } else {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
        }
      });
    }

    // Totals row
    const totalsRow = sheet.addRow({
      transactionId: 'TOTAL',
      transactionValue: group.totalValue,
      qty: group.totalQuantity > 0 ? group.totalQuantity : '',
    });
    totalsRow.font = { name: 'Calibri', size: 10, bold: true };
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    totalsRow.eachCell((cell, colNumber) => {
      cell.border = thinBorder;
      if (colNumber === 6 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
      if (colNumber === 7 && typeof cell.value === 'number') cell.numFmt = '#,##0';
    });
  }

  // TX-1: SERIALIZE WORKBOOK TO BUFFER
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const xlsxBlob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  // TX-1: UPLOAD TO SUPABASE STORAGE (private bucket, versioned path)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = `${fileId}/${timestamp}/transactions_all_funds.xlsx`;

  const uploadResult = await uploadReportToStorage(storagePath, xlsxBlob);

  if (!uploadResult.success) {
    throw new Error(
      `Storage upload failed for transaction report (fileId: ${fileId}): ${uploadResult.error}`
    );
  }

  // TX-1: PERSIST GENERATED REPORT RECORD WITH REAL STORAGE PATH
  const createdBy = userId && UUID_REGEX.test(userId) ? userId : null;
  const fileIdForDB = UUID_REGEX.test(fileId) ? fileId : null;

  const { data, error } = await supabase
    .from('generated_reports')
    .insert([
      {
        file_id: fileIdForDB,
        fund_id: null,
        report_version: `V1.0`,
        version_number: 1,
        storage_path: storagePath,
        storage_bucket: 'reports',
        file_size_bytes: xlsxBuffer.byteLength,
        created_by: createdBy,
      },
    ])
    .select('id')
    .single();

  if (error || !data) {
    // TX-2: Throw on insert failure — do not silently swallow
    throw new Error(
      `generated_reports insert failed after storage upload (path: ${storagePath}): ${error?.message || 'No data returned'}`
    );
  }

  return {
    groupedOutputs,
    totalProductsCount: groupedOutputs.length,
    totalGeneratedRows: generatedRows.length,
    reportId: String(data.id),
    storagePath,
  };
}
