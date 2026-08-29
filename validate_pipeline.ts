import fs from 'fs';
import ExcelJS from 'exceljs';
import { parseTradingExcel, exportSingleFundTransactionSheet, exportTransactionSheetsPerProduct } from './src/lib/excel-engine';
import { applyFundRules } from './src/lib/rule-engine';
import { FundRule, GeneratedTransactionRow, RawTransactionRow } from './src/lib/types';

// Mock fund rules matching the database seeds for validation testing
const DEFAULT_FUND_RULES: FundRule[] = [
  {
    id: 'rule-t0-buy',
    fundType: 'T0',
    orderSide: 'BUY',
    isTransactionValueVisible: true,
    isQuantityVisible: true,
  },
  {
    id: 'rule-t0-sell',
    fundType: 'T0',
    orderSide: 'SELL',
    isTransactionValueVisible: true,
    isQuantityVisible: true,
  },
  {
    id: 'rule-t1-buy',
    fundType: 'T1',
    orderSide: 'BUY',
    isTransactionValueVisible: true,
    isQuantityVisible: false,
  },
  {
    id: 'rule-t1-sell',
    fundType: 'T1',
    orderSide: 'SELL',
    isTransactionValueVisible: false,
    isQuantityVisible: true,
  },
];

async function runValidation() {
  console.log('====================================================');
  console.log('STEP 1: VALIDATING REQUEST ID FIX ON REAL BUSINESS FILE');
  console.log('====================================================');

  const filePath = 'C:/Users/Goo/Downloads/الاوردرات كامله البيانات .xlsx';
  const buf = fs.readFileSync(filePath);
  const file = new File([buf], 'الاوردرات كامله البيانات .xlsx');

  // Parse raw rows using updated excel-engine
  const rawRows: RawTransactionRow[] = await parseTradingExcel(file);
  console.log(`Parsed ${rawRows.length} raw transactions from file.`);

  // Generate output rows using applyFundRules
  const generatedRows: GeneratedTransactionRow[] = rawRows.map(r => 
    applyFundRules(r, 'T1', DEFAULT_FUND_RULES, '8/29/2026')
  );

  // Export Beltone EGX100 Fund specifically
  const beltoneBlob = await exportSingleFundTransactionSheet(generatedRows, 'Beltone EGX100 Fund');
  const beltonePath = 'C:/Users/Goo/Downloads/Beltone_EGX100_Fund_NEW_VALIDATED.xlsx';
  fs.writeFileSync(beltonePath, Buffer.from(await beltoneBlob.arrayBuffer()));
  console.log(`Generated and saved: ${beltonePath}`);

  // Inspect generated file
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(beltonePath);
  const ws = wb.worksheets[0];

  console.log(`\nInspecting generated sheet "${ws.name}" (${ws.rowCount} rows):`);
  let minusOneCount = 0;
  for (let r = 1; r <= ws.rowCount; r++) {
    const rowVals = ws.getRow(r).values as unknown[];
    const txId = String(rowVals[1] || '');
    const clientName = String(rowVals[5] || '');
    const txVal = rowVals[6];
    const qty = rowVals[7];

    if (txId === '-1' || txId.trim() === '-1') {
      minusOneCount++;
      console.log(`[ALERT] Row ${r}: TxID is still "-1"!`);
    }

    if (r > 1) {
      console.log(`  Row ${r}: TxID="${txId}" | Client="${clientName}" | Value=${txVal} | Qty=${qty}`);
    }
  }

  console.log(`\nOccurrences of "-1" in Beltone EGX100: ${minusOneCount}`);

  // Check the three benchmark rows specifically:
  const checkClients = [
    'MOHAMED MAGDY ABD EL KADER ABD EL TAWAB',
    'ZAHER AYOUB MARCOS ATTALLAH',
    'MEDHAT SHABAAN ABAAS SALEM'
  ];

  console.log('\n--- BENCHMARK ROW COMPARISONS (BEFORE vs AFTER) ---');
  for (const client of checkClients) {
    const raw = rawRows.find(r => r.customerName === client);
    const gen = generatedRows.find(r => r.name === client);
    console.log(`\nClient: ${client}`);
    console.log(`  Raw Request ID (Col 1): ${raw?.requestId}`);
    console.log(`  Generated Transaction ID: ${gen?.transactionId}`);
    console.log(`  Status: ${gen?.transactionId !== '-1' && !gen?.transactionId?.includes('-1') ? 'PASSED (Clean Request ID)' : 'FAILED'}`);
  }

  // Check ALL generated sheets
  console.log('\nScanning ALL fund sheets for "-1"...');
  const allBlob = await exportTransactionSheetsPerProduct(generatedRows);
  const allPath = 'C:/Users/Goo/Downloads/All_Transaction_Reports_NEW_VALIDATED.xlsx';
  fs.writeFileSync(allPath, Buffer.from(await allBlob.arrayBuffer()));

  const allWb = new ExcelJS.Workbook();
  await allWb.xlsx.readFile(allPath);
  let totalMinusOnes = 0;
  let totalRows = 0;
  for (const sheet of allWb.worksheets) {
    for (let r = 2; r <= sheet.rowCount; r++) {
      totalRows++;
      const txId = String(sheet.getRow(r).getCell(1).value || '').trim();
      if (txId === '-1') {
        totalMinusOnes++;
        console.log(`[ALERT] In sheet "${sheet.name}" Row ${r}: TxID is "-1"`);
      }
    }
  }
  console.log(`Total rows checked across ${allWb.worksheets.length} sheets: ${totalRows}`);
  console.log(`Total occurrences of "-1" in Transaction ID: ${totalMinusOnes}`);

  console.log('\n====================================================');
  console.log('STEP 2: T0 vs T1 BEHAVIOR VERIFICATION (BEFORE / AFTER)');
  console.log('====================================================');

  // Take one BUY row and one SELL row
  const buyRow = rawRows.find(r => r.orderSide.toUpperCase() === 'BUY' && r.orderValue > 0 && r.quantity > 0)!;
  const sellRow = rawRows.find(r => r.orderSide.toUpperCase() === 'SELL' && r.quantity > 0) || {
    id: 'sim-sell',
    fileId: 'file-1',
    requestId: 'IPO260825-1-SELL01',
    mubasherNo: '123456789',
    customerName: 'AHMED HASSAN TESTER',
    orderSide: 'SELL',
    symbol: buyRow.symbol,
    symbolDescription: buyRow.symbolDescription,
    quantity: 500,
    price: buyRow.price,
    orderValue: 500 * buyRow.price,
    orderDate: '2026-08-29'
  };

  const buyAsT0 = applyFundRules(buyRow, 'T0', DEFAULT_FUND_RULES);
  const buyAsT1 = applyFundRules(buyRow, 'T1', DEFAULT_FUND_RULES);

  const sellAsT0 = applyFundRules(sellRow, 'T0', DEFAULT_FUND_RULES);
  const sellAsT1 = applyFundRules(sellRow, 'T1', DEFAULT_FUND_RULES);

  console.log('\n[TEST CASE A: BUY ORDER] Customer:', buyRow.customerName);
  console.log(`Input Values: Order Value = ${buyRow.orderValue}, Quantity = ${buyRow.quantity}`);
  console.log('  -> Under T0 (Cash/Money Market):');
  console.log(`     Transaction Value: ${buyAsT0.transactionValue} (VISIBLE)`);
  console.log(`     Quantity:          ${buyAsT0.qty} (VISIBLE)`);
  console.log('  -> Under T1 (Equity/Stocks):');
  console.log(`     Transaction Value: ${buyAsT1.transactionValue} (VISIBLE)`);
  console.log(`     Quantity:          ${buyAsT1.qty} (BLANK/NULL - Hidden)`);

  console.log('\n[TEST CASE B: SELL ORDER] Customer:', sellRow.customerName);
  console.log(`Input Values: Order Value = ${sellRow.orderValue}, Quantity = ${sellRow.quantity}`);
  console.log('  -> Under T0 (Cash/Money Market):');
  console.log(`     Transaction Value: ${sellAsT0.transactionValue} (VISIBLE)`);
  console.log(`     Quantity:          ${sellAsT0.qty} (VISIBLE)`);
  console.log('  -> Under T1 (Equity/Stocks):');
  console.log(`     Transaction Value: ${sellAsT1.transactionValue} (BLANK/NULL - Hidden)`);
  console.log(`     Quantity:          ${sellAsT1.qty} (VISIBLE)`);
}

runValidation().catch(console.error);
