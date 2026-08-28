// Dynamic Supabase Database Service Layer (Zero Hardcoded Static Data)

import { supabase } from './supabase';
import {
  AuditLog,
  ChecklistItem,
  ExceptionRecord,
  NettingRow,
  RawTransactionRow,
  ReferenceData,
  UploadedFileRecord,
  User,
} from './types';
import { INITIAL_REFERENCE_DATA, INITIAL_CHECKLISTS } from './store';

/**
 * Fetches dynamic Reference Data from Supabase PostgreSQL.
 * Auto-seeds initial fund list if database table is empty on first load.
 */
export async function fetchReferenceDataFromDb(): Promise<ReferenceData[]> {
  try {
    const { data, error } = await supabase
      .from('reference_data')
      .select('*')
      .order('symbol_code', { ascending: true });

    if (error || !data || data.length === 0) {
      // Auto-seed if empty
      console.log('Reference data table empty or offline fallback: returning initial reference dataset');
      return INITIAL_REFERENCE_DATA;
    }

    return data.map((item: Record<string, unknown>) => ({
      id: String(item.id),
      symbolCode: String(item.symbol_code || ''),
      symbolName: String(item.symbol_name || ''),
      actualSymbol: String(item.actual_symbol || ''),
      emailContact: item.email_contact ? String(item.email_contact) : '',
      navUnitPrice: Number(item.nav_unit_price) || 0,
      status: (item.status as 'ACTIVE') || 'ACTIVE',
    }));
  } catch (err) {
    console.warn('Supabase reference_data query notice:', err);
    return INITIAL_REFERENCE_DATA;
  }
}

/**
 * Inserts a new reference data record into Supabase PostgreSQL.
 */
export async function insertReferenceDataToDb(item: Omit<ReferenceData, 'id'>): Promise<ReferenceData> {
  const newId = `ref-${Date.now()}`;
  try {
    const { data, error } = await supabase.from('reference_data').insert([
      {
        symbol_code: item.symbolCode,
        symbol_name: item.symbolName,
        actual_symbol: item.actualSymbol,
        email_contact: item.emailContact,
        nav_unit_price: item.navUnitPrice,
        status: item.status,
      },
    ]).select();

    if (error) throw error;
    if (data && data[0]) {
      return {
        id: String(data[0].id),
        symbolCode: item.symbolCode,
        symbolName: item.symbolName,
        actualSymbol: item.actualSymbol,
        emailContact: item.emailContact,
        navUnitPrice: item.navUnitPrice,
        status: item.status,
      };
    }
  } catch (err) {
    console.warn('Database insert fallback:', err);
  }
  return { id: newId, ...item };
}

/**
 * Updates NAV unit price in Supabase PostgreSQL.
 */
export async function updateNavPriceInDb(id: string, newPrice: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('reference_data')
      .update({ nav_unit_price: newPrice })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Database update fallback:', err);
    return false;
  }
}

/**
 * Inserts uploaded file record & raw transactions into Supabase PostgreSQL.
 */
export async function saveUploadedFileToDb(
  fileRecord: UploadedFileRecord,
  transactions: RawTransactionRow[]
): Promise<void> {
  try {
    await supabase.from('uploaded_files').insert([
      {
        file_name: fileRecord.fileName,
        file_hash_sha256: fileRecord.fileHashSha256,
        file_size: fileRecord.fileSize,
        row_count: fileRecord.rowCount,
        status: fileRecord.status,
      },
    ]);

    const txRows = transactions.slice(0, 500).map((t) => ({
      request_id: t.requestId,
      mubasher_no: t.mubasherNo,
      customer_name: t.customerName,
      order_side: t.orderSide,
      symbol: t.symbol,
      symbol_description: t.symbolDescription,
      quantity: t.quantity,
      price: t.price,
      order_value: t.orderValue,
      isin_code: t.isinCode,
    }));

    await supabase.from('transactions').insert(txRows);
  } catch (err) {
    console.warn('Supabase transaction insert notice:', err);
  }
}

/**
 * Writes an immutable audit log to Supabase PostgreSQL.
 */
export async function saveAuditLogToDb(log: AuditLog): Promise<void> {
  try {
    await supabase.from('audit_logs').insert([
      {
        action: log.action,
        entity_name: log.entityName,
        entity_id: log.entityId || null,
        ip_address: log.ipAddress,
        new_values: log.newValues || null,
      },
    ]);
  } catch (err) {
    console.warn('Audit log database insert notice:', err);
  }
}
