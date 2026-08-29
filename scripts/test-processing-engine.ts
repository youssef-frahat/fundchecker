// End-to-End Verification Test Script for Operational Processing Engine

import { RawTransactionRow } from '../lib/types';
import { executeProcessingPipeline } from '../lib/services/processingEngine';

async function runEndToEndEngineTest() {
  console.log('====================================================');
  console.log('STARTING OPERATIONAL PROCESSING ENGINE E2E VERIFICATION');
  console.log('====================================================\n');

  // Sample incoming raw trade file rows (Simulating 39-column trade ingestion)
  const sampleRawRows: RawTransactionRow[] = [
    {
      id: 'tx-1',
      fileId: 'file-temp',
      requestId: 'REQ-10001',
      mubasherNo: 'MUB-8801',
      customerName: 'Youssef Farahat',
      orderSide: 'BUY',
      symbol: '1001', // Mapped symbol: AZ - ADKHAR (T0)
      symbolDescription: 'AZ - ADKHAR',
      quantity: 500,
      price: 21.13012,
      orderValue: 10565.06,
      orderDate: new Date().toISOString(),
    },
    {
      id: 'tx-2',
      fileId: 'file-temp',
      requestId: 'REQ-10002',
      mubasherNo: 'MUB-8802',
      customerName: 'Ahmed Sayed',
      orderSide: 'SELL',
      symbol: '1001', // Mapped symbol: AZ - ADKHAR (T0)
      symbolDescription: 'AZ - ADKHAR',
      quantity: 200,
      price: 21.13012,
      orderValue: 4226.02,
      orderDate: new Date().toISOString(),
    },
    {
      id: 'tx-3',
      fileId: 'file-temp',
      requestId: 'REQ-10003',
      mubasherNo: 'MUB-8803',
      customerName: 'Ahmed Gamal',
      orderSide: 'BUY',
      symbol: '1006', // Mapped symbol: Aafaq Investment Fund (T1)
      symbolDescription: 'Aafaq Investment Fund',
      quantity: 100,
      price: 264.2139,
      orderValue: 26421.39,
      orderDate: new Date().toISOString(),
    },
    {
      id: 'tx-4',
      fileId: 'file-temp',
      requestId: 'REQ-10004',
      mubasherNo: 'MUB-8804',
      customerName: 'Hussein Mohamed',
      orderSide: 'BUY',
      symbol: 'UNKNOWN_TEST_STOCK', // Unmapped symbol -> Exception trigger
      symbolDescription: 'Non-Existent Fund',
      quantity: 50,
      price: 100.0,
      orderValue: 5000.0,
      orderDate: new Date().toISOString(),
    },
  ];

  const fileName = `Trade_Orders_${Date.now()}.xlsx`;
  const fileHash = `hash-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  const fileSize = 1048576; // 1 MB

  try {
    console.log(`[1] Initiating pipeline for file "${fileName}" (${sampleRawRows.length} rows)...`);
    const report = await executeProcessingPipeline(fileName, fileHash, fileSize, sampleRawRows, 'user-ops-admin');

    console.log('\n====================================================');
    console.log('PIPELINE EXECUTION SUMMARY REPORT');
    console.log('====================================================');
    console.log(`Execution ID    : ${report.executionId}`);
    console.log(`File ID         : ${report.fileId}`);
    console.log(`File Hash       : ${report.fileHashSha256}`);
    console.log(`Total Rows      : ${report.totalRowsProcessed}`);
    console.log(`Valid Rows      : ${report.validRowsCount}`);
    console.log(`Invalid Rows    : ${report.invalidRowsCount}`);
    console.log(`Mapped Rows     : ${report.mappedRowsCount}`);
    console.log(`Unmapped Rows   : ${report.unmappedRowsCount}`);
    console.log(`Exceptions Logged: ${report.exceptionsCount}`);
    console.log(`Audit Logs Generated: ${report.auditLogsCount}`);

    console.log('\n====================================================');
    console.log('ROW-LEVEL TRACEABILITY PROOF (Input -> Validation -> Mapping -> Rule -> Output)');
    console.log('====================================================');
    report.traceabilityLog.forEach((item, idx) => {
      console.log(`\nRow #${idx + 1} | Req ID: ${item.requestId} | Investor: ${item.customerName}`);
      console.log(`  ├─ Input       : ${item.orderSide} ${item.inputSymbol} (Qty: ${item.inputQuantity}, Price: ${item.inputPrice}, Value: ${item.inputOrderValue})`);
      console.log(`  ├─ Validation  : ${item.validationResult}`);
      console.log(`  ├─ Mapping     : ${item.mappingResult} -> Target: [${item.targetSymbolCode}] ${item.targetSymbolName}`);
      console.log(`  ├─ Rule Applied: ${item.ruleApplied}`);
      console.log(`  └─ Output Row  : Product: "${item.productGroup}" | Transaction Value: ${item.transactionValueOutput} | Qty: ${item.qtyOutput}`);
    });

    console.log('\n====================================================');
    console.log('TRANSFER SHEET NETTING CALCULATION OUTPUT');
    console.log('====================================================');
    console.log(`Total Buy  : ${report.transferGeneratorResult.nettingSummary.totalBuy}`);
    console.log(`Total Sell : ${report.transferGeneratorResult.nettingSummary.totalSell}`);
    console.log(`Total Net  : ${report.transferGeneratorResult.nettingSummary.totalNet} (Sell - Buy)`);
    console.log('Netting Rows Detail:');
    report.transferGeneratorResult.nettingSummary.rows.forEach((r) => {
      if (r.buyTotal > 0 || r.sellTotal > 0) {
        console.log(`  - [${r.symbolCode}] ${r.symbolName} | Buy: ${r.buyTotal} | Sell: ${r.sellTotal} | Net: ${r.netAmount}`);
      }
    });

    if (report.exceptions.length > 0) {
      console.log('\n====================================================');
      console.log('EXCEPTIONS GENERATED IN QUEUE');
      console.log('====================================================');
      report.exceptions.forEach((ex, idx) => {
        console.log(`  ${idx + 1}. [${ex.exceptionType}] ${ex.errorMessage}`);
      });
    }

    console.log('\n====================================================');
    console.log('VERIFICATION COMPLETE: ALL PIPELINE MODULES EXECUTED SUCCESSFULLY');
    console.log('====================================================');
  } catch (err: unknown) {
    console.error('Pipeline execution error:', err);
  }
}

runEndToEndEngineTest();
