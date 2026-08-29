import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import { parseTradingExcel } from './src/lib/excel-engine';

async function main() {
  const dir = 'C:/Users/Goo/Downloads';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  
  for (const f of files) {
    const fullPath = path.join(dir, f);
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.readFile(fullPath);
    } catch {
      continue;
    }

    for (const ws of wb.worksheets) {
      if (ws.rowCount < 2) continue;
      const headers = ws.getRow(1).values as string[];
      
      let minusOneCount = 0;
      const minusOneCols = new Set<number>();

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        row.eachCell((cell, colNumber) => {
          const val = String(cell.value || '').trim();
          if (val === '-1') {
            minusOneCount++;
            minusOneCols.add(colNumber);
          }
        });
      }

      if (minusOneCount > 0) {
        console.log(`[FILE] ${f} | [SHEET] ${ws.name}`);
        console.log(`  Found ${minusOneCount} occurrences of "-1" in columns:`);
        minusOneCols.forEach(col => {
          console.log(`    Col ${col}: "${headers[col]}"`);
        });

        // Check how parseTradingExcel parses this file
        const buf = fs.readFileSync(fullPath);
        const fileObj = new File([buf], f);
        const parsed = await parseTradingExcel(fileObj);
        const parsedMinusOnes = parsed.filter(p => p.requestId === '-1' || p.requestId.includes('-1'));
        console.log(`  parseTradingExcel parsed ${parsed.length} rows, of which ${parsedMinusOnes.length} have requestId containing "-1"`);
        if (parsedMinusOnes.length > 0) {
          console.log(`  Sample parsed row with -1:`, {
            requestId: parsedMinusOnes[0].requestId,
            mubasherNo: parsedMinusOnes[0].mubasherNo,
            cust: parsedMinusOnes[0].customerName,
            sym: parsedMinusOnes[0].symbol
          });
        }
      }
    }
  }
}

main().catch(console.error);
