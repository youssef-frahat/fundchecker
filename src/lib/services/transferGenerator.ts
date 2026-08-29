// Transfer Generator - Netting Sheet Calculation, Excel Generation & Transfer Persistence
// REMEDIATION NET-3: Throws on DB insert failure (no silent swallowing)
// USER IMAGE ALIGNMENT: Generates Excel file matching media_1788005938657.png and uploads to Supabase Storage

import ExcelJS from 'exceljs';
import { supabase } from '../supabase';
import { NettingSummary, calculateNettingSheet } from '../netting-engine';
import { RawTransactionRow, ReferenceData } from '../types';
import { uploadReportToStorage } from './storageService';

export interface TransferGeneratorResult {
  nettingSummary: NettingSummary;
  transferSheetId?: string;
  storagePath?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateTransferSheet(
  fileId: string,
  rawTransactions: RawTransactionRow[],
  referenceDataList: ReferenceData[],
  userId?: string
): Promise<TransferGeneratorResult> {
  // NET-1: calculateNettingSheet uses net_settle internally
  const nettingSummary = calculateNettingSheet(rawTransactions, referenceDataList, 'symbol');

  // BUILD NETTING EXCEL WORKBOOK MATCHING media_1788005938657.png
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Investment Operations Platform';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Netting Transfer Sheet');
  ws.views = [{ showGridLines: true }];

  // Column definitions
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

  // Format Header Row
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  for (let c = 1; c <= 6; c++) {
    headerRow.getCell(c).border = headerBorder;
  }

  // Populate data rows exactly matching media_1788005938657.png
  nettingSummary.rows.forEach((row, idx) => {
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

    // Apply borders and fonts
    for (let c = 1; c <= 6; c++) {
      const cell = addedRow.getCell(c);
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10 };

      // Left-align text columns
      if (c <= 3) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
      // Number formatting for Buy & Sell
      if (c === 4 || c === 5) {
        if (typeof cell.value === 'number') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      }
      // NET Column styling (Column 6) matching media_1788005938657.png:
      // Positive: Soft light green fill (#C6EFCE), dark green text (#006100), bold
      // Negative: Soft light red/pink fill (#FFC7CE), dark red text (#9C0006), formatted as (275,464.47), bold
      // Zero: '-' centered
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

    // Add side notes from media_1788005938657.png (USD transfers section)
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

  // Total Summary Row at bottom
  const totalRow = ws.addRow({
    symbolCode: 'TOTAL SUMMARY',
    symbolName: '',
    actualSymbol: '',
    buy: nettingSummary.totalBuy,
    sell: nettingSummary.totalSell,
    net: nettingSummary.totalNet,
  });
  totalRow.height = 24;
  totalRow.font = { name: 'Calibri', size: 11, bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

  for (let c = 1; c <= 6; c++) {
    const cell = totalRow.getCell(c);
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
      if (nettingSummary.totalNet > 0) {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF006100' } };
      } else if (nettingSummary.totalNet < 0) {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF9C0006' } };
      }
    }
  }

  // SERIALIZE AND UPLOAD TO STORAGE
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const xlsxBlob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = `${fileId}/${timestamp}/transfer_netting_sheet.xlsx`;

  const uploadResult = await uploadReportToStorage(storagePath, xlsxBlob);
  if (!uploadResult.success) {
    console.warn(`Warning: Netting sheet storage upload failed: ${uploadResult.error}`);
  }

  // PERSIST IN DATABASE
  const fileIdForDB = UUID_REGEX.test(fileId) ? fileId : null;

  const { data, error } = await supabase
    .from('transfer_sheets')
    .insert([
      {
        file_id: fileIdForDB,
        fund_id: null,
        group_by_field: 'symbol',
        total_buy: nettingSummary.totalBuy,
        total_sell: nettingSummary.totalSell,
        net_transfer: nettingSummary.totalNet,
        status: 'DRAFT',
      },
    ])
    .select('id')
    .single();

  // NET-3: Throw on insert failure — pipeline must not silently lose transfer sheet reference
  if (error || !data) {
    throw new Error(
      `transfer_sheets insert failed for fileId "${fileId}": ${error?.message || 'No data returned'}`
    );
  }

  return {
    nettingSummary,
    transferSheetId: String(data.id),
    storagePath,
  };
}
