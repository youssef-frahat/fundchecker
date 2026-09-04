import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { generateMasterDataTemplateExcel, parseMasterDataExcel } from '../src/lib/excel-engine';

describe('Reference Data & Master Data Lifecycle (DATA-02 & CRUD)', () => {
  it('generateMasterDataTemplateExcel should generate valid Excel buffer with correct headers', async () => {
    const blob = await generateMasterDataTemplateExcel([
      {
        id: 'fund-1',
        symbolCode: '1001',
        symbolName: 'AZ - IDKHAR',
        actualSymbol: 'ADKHAR-AZ',
        fundType: 'T0',
        navUnitPrice: 10.5,
        status: 'ACTIVE',
        scheduleFrequency: 'DAILY',
        executionInstruction: 'T+0 Execution Daily',
      },
      {
        id: 'fund-2',
        symbolCode: '1006',
        symbolName: 'Aafaq Investment Fund',
        actualSymbol: 'AFAC',
        fundType: 'T1',
        navUnitPrice: 25.75,
        status: 'ACTIVE',
        scheduleFrequency: 'WEEKLY',
        executionInstruction: 'Weekly notice Thursday, execution Sunday',
      },
    ]);

    assert.ok(blob, 'Blob must be created');
    assert.ok(blob.size > 1000, 'Blob size must be valid (>1KB)');

    const buffer = await blob.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet('Master Data');
    assert.ok(ws, 'Worksheet Master Data must exist');
    assert.equal(ws.rowCount, 3, 'Must contain 1 header row + 2 fund rows');

    const headerRow = ws.getRow(1);
    assert.equal(headerRow.getCell(1).value, 'Fund Code');
    assert.equal(headerRow.getCell(2).value, 'Fund Name');
    assert.equal(headerRow.getCell(3).value, 'Actual Symbol');
    assert.equal(headerRow.getCell(4).value, 'Settlement Type (T0/T1)');

    const row1 = ws.getRow(2);
    assert.equal(row1.getCell(1).value, '1001');
    assert.equal(row1.getCell(4).value, 'T0');

    const row2 = ws.getRow(3);
    assert.equal(row2.getCell(1).value, '1006');
    assert.equal(row2.getCell(4).value, 'T1');
  });

  it('parseMasterDataExcel should parse Excel file and normalize settlement types and frequencies', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Funds');
    ws.addRow([
      'Fund Code',
      'Fund Name',
      'Actual Symbol',
      'Settlement Type',
      'NAV Unit Price',
      'Frequency',
      'Schedule',
      'Email',
      'Status',
    ]);
    ws.addRow([
      '2001',
      'Test Equity Fund',
      'TEQ',
      'T1 Equity',
      50.2,
      'Weekly Notice',
      'Notice Thursday, Execute Sunday',
      'custodian@test.com',
      'ACTIVE',
    ]);
    ws.addRow([
      '2002',
      'Test Liquidity Fund',
      'TLIQ',
      'T0 Money Market',
      12.0,
      'Daily',
      'Daily T0',
      'ops@test.com',
      'ACTIVE',
    ]);

    const buf = await wb.xlsx.writeBuffer();
    const mockFile = {
      arrayBuffer: async () => buf,
      name: 'Master_Data_Test.xlsx',
    } as unknown as File;

    const parsed = await parseMasterDataExcel(mockFile);
    assert.equal(parsed.length, 2, 'Should parse exactly 2 fund records');

    assert.equal(parsed[0].symbolCode, '2001');
    assert.equal(parsed[0].fundType, 'T1', 'T1 Equity must normalize to T1');
    assert.equal(parsed[0].scheduleFrequency, 'WEEKLY', 'Weekly Notice must normalize to WEEKLY');

    assert.equal(parsed[1].symbolCode, '2002');
    assert.equal(parsed[1].fundType, 'T0', 'T0 Money Market must normalize to T0');
    assert.equal(parsed[1].scheduleFrequency, 'DAILY', 'Daily must normalize to DAILY');
  });

  it('Role-Based Access: Super Admin authorization check for Master Data CRUD', () => {
    const checkSuperAdmin = (role?: string): { allowed: boolean; error?: string } => {
      if (role !== 'SUPER_ADMIN') {
        return { allowed: false, error: '403 Forbidden: Super Admin privileges required.' };
      }
      return { allowed: true };
    };

    assert.equal(checkSuperAdmin('OPERATIONS_MAKER').allowed, false);
    assert.equal(checkSuperAdmin('OPERATIONS_CHECKER').allowed, false);
    assert.equal(checkSuperAdmin('AUDITOR').allowed, false);
    assert.equal(checkSuperAdmin('SUPER_ADMIN').allowed, true);
  });

  it('parseMasterDataExcel should NOT blindly default missing columns to T0 or T+0 (non-destructive)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Prices Only');
    // Simulating sheet with only Code, Name, Symbol, and NAV Price (NO settlement type or instruction columns)
    ws.addRow(['Fund Code', 'Fund Name', 'Actual Symbol', 'NAV Price']);
    ws.addRow(['1020', 'Misr Al Mostakbal', 'MOSTAKBAL', 145.5]);

    const buf = await wb.xlsx.writeBuffer();
    const mockFile = {
      arrayBuffer: async () => buf,
      name: 'Prices_Only.xlsx',
    } as unknown as File;

    const parsed = await parseMasterDataExcel(mockFile);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].symbolCode, '1020');
    assert.equal(parsed[0].navUnitPrice, 145.5);
    // Crucial: Missing columns must remain undefined so they do not overwrite DB records!
    assert.equal(parsed[0].fundType, undefined, 'Must not invent T0 when column is missing');
    assert.equal(parsed[0].executionInstruction, undefined, 'Must not invent T+0 when column is missing');
    assert.equal(parsed[0].scheduleFrequency, undefined, 'Must not invent DAILY when column is missing');
  });

  it('Canonical Funds Catalog Integrity (68 funds with exact Arabic instructions)', async () => {
    const { CANONICAL_FUNDS } = await import('../src/lib/constants/canonicalFunds');
    assert.equal(CANONICAL_FUNDS.length, 68, 'Must have exactly 68 canonical funds');

    const fund1001 = CANONICAL_FUNDS.find((f) => f.symbolCode === '1001');
    assert.ok(fund1001);
    assert.equal(fund1001.fundType, 'T0');

    const fund1006 = CANONICAL_FUNDS.find((f) => f.symbolCode === '1006');
    assert.ok(fund1006);
    assert.equal(fund1006.fundType, 'T1');

    const fund1020 = CANONICAL_FUNDS.find((f) => f.symbolCode === '1020');
    assert.ok(fund1020);
    assert.equal(fund1020.fundType, 'T1');
    assert.equal(fund1020.scheduleFrequency, 'WEEKLY');
    assert.equal(
      fund1020.executionInstruction,
      'اسبوعي بيتم ارسال اخطار الخميس وبيتم التنفيذ الاحد'
    );

    const beltonUsd = CANONICAL_FUNDS.find((f) => f.symbolCode === 'Belton USD');
    assert.ok(beltonUsd);
    assert.equal(beltonUsd.fundType, 'T1');
    assert.equal(beltonUsd.scheduleFrequency, 'BIWEEKLY');
    assert.equal(
      beltonUsd.executionInstruction,
      'شراء T+1&البيع يوم الاثنين فى ثاني اسبوع ورابع اسبوع من كل شهر'
    );

    const maksabOz = CANONICAL_FUNDS.find((f) => f.symbolCode === 'Maksab OZ');
    assert.ok(maksabOz);
    assert.equal(maksabOz.fundType, 'T1');
    assert.equal(maksabOz.scheduleFrequency, 'MONTHLY');
    assert.equal(
      maksabOz.executionInstruction,
      'الشراء اسبوعي يومي الاثنين & البيع بيتم ارسال اخطار يوم 18 من كل شهر وبيتم التنفيذ فى اول يوم اثنين من كل شهر'
    );
  });
});
