// Reference Repository - Database Access for Reference Data, Fund Master & Dynamic Rules
// PRODUCTION MODE: No mock fallbacks. All data must come from the database.

import { getDbClient } from '../db-client';
import { Fund, FundRule, ReferenceData } from '../types';
import { CANONICAL_FUNDS } from '../constants/canonicalFunds';

export async function fetchAllReferenceData(): Promise<ReferenceData[]> {
  const supabase = await getDbClient();

  const [{ data, error }, { data: schedules }] = await Promise.all([
    supabase
      .from('reference_data')
      .select('*')
      .order('symbol_code', { ascending: true }),
    supabase
      .from('fund_schedules')
      .select('*')
  ]);

  if (error) {
    throw new Error(
      `[DB ERROR] fetchAllReferenceData: ${error.message}. ` +
      `Run supabase/schema.sql in the Supabase SQL editor to create and seed reference_data.`
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      `[DB ERROR] fetchAllReferenceData: reference_data table is empty. ` +
      `Run supabase/schema.sql in the Supabase SQL editor to seed fund reference data.`
    );
  }

  const schedMap = new Map<string, { frequency: string; raw_instruction: string }>();
  if (schedules) {
    for (const s of schedules) {
      if (s.fund_code) {
        schedMap.set(String(s.fund_code).trim().toLowerCase(), {
          frequency: s.frequency,
          raw_instruction: s.raw_instruction
        });
      }
    }
  }

  return data.map((item: Record<string, unknown>) => {
    const sym = String(item.symbol_code || '').trim().toLowerCase();
    const act = String(item.actual_symbol || '').trim().toLowerCase();
    const sched = schedMap.get(sym) || schedMap.get(act);

    return {
      id: String(item.id),
      symbolCode: String(item.symbol_code || ''),
      symbolName: String(item.symbol_name || ''),
      actualSymbol: String(item.actual_symbol || ''),
      emailContact: item.email_contact ? String(item.email_contact) : '',
      navUnitPrice: Number(item.nav_unit_price) || 0,
      fundType: (String(item.fund_type || 'T0')) as import('../types').SettlementType,
      fundId: item.fund_id ? String(item.fund_id) : undefined,
      status: (item.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CLOSED') || 'ACTIVE',
      scheduleFrequency: sched?.frequency || 'DAILY',
      executionInstruction: sched?.raw_instruction || (item.fund_type === 'T1' ? 'T+1' : 'T+0'),
      createdAt: item.created_at ? String(item.created_at) : new Date().toISOString(),
    };
  });
}

export async function fetchAllFundRules(): Promise<FundRule[]> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from('fund_rules')
    .select('*');

  if (error) {
    throw new Error(
      `[DB ERROR] fetchAllFundRules: ${error.message}. ` +
      `Run supabase/schema.sql in the Supabase SQL editor to create and seed fund_rules.`
    );
  }

  if (!data || data.length === 0) {
    throw new Error(
      `[DB ERROR] fetchAllFundRules: fund_rules table is empty. ` +
      `Run supabase/schema.sql in the Supabase SQL editor to seed T0/T1 settlement rules.`
    );
  }

  return data.map((item: Record<string, unknown>) => ({
    id: String(item.id),
    fundType: String(item.fund_type),
    orderSide: item.order_side as 'BUY' | 'SELL',
    isTransactionValueVisible: Boolean(item.is_transaction_value_visible),
    isQuantityVisible: Boolean(item.is_quantity_visible),
  }));
}

export async function fetchAllFunds(): Promise<Fund[]> {
  const supabase = await getDbClient();

  const { data, error } = await supabase
    .from('funds')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('fund_code', { ascending: true });

  if (error) {
    throw new Error(
      `[DB ERROR] fetchAllFunds: ${error.message}. ` +
      `Run supabase/schema.sql in the Supabase SQL editor to create the funds table.`
    );
  }

  // funds may be legitimately empty before any are created via Fund Admin UI
  if (!data || data.length === 0) {
    return [];
  }

  return data.map((item: Record<string, unknown>) => ({
    id: String(item.id),
    fundCode: String(item.fund_code),
    fundName: String(item.fund_name),
    fundType: String(item.fund_type),
    status: (item.status as 'ACTIVE') || 'ACTIVE',
    createdAt: String(item.created_at),
  }));
}

/**
 * Inserts a new reference data record into PostgreSQL and syncs fund_schedules.
 */
export async function insertReferenceDataInDb(
  item: Omit<ReferenceData, 'id'>,
  userId?: string
): Promise<ReferenceData> {
  const supabase = await getDbClient();
  const { data, error } = await supabase
    .from('reference_data')
    .insert([
      {
        symbol_code: item.symbolCode.trim(),
        symbol_name: item.symbolName.trim(),
        actual_symbol: item.actualSymbol.trim(),
        email_contact: item.emailContact?.trim() || null,
        nav_unit_price: item.navUnitPrice || 0,
        fund_type: item.fundType || 'T0',
        status: item.status || 'ACTIVE',
        created_by: userId || null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`[DB ERROR] insertReferenceDataInDb: ${error.message}`);
  }

  if (item.scheduleFrequency || item.executionInstruction) {
    await supabase.from('fund_schedules').insert({
      fund_code: item.symbolCode.trim(),
      fund_type: item.fundType || 'T0',
      frequency: item.scheduleFrequency || 'DAILY',
      raw_instruction: item.executionInstruction || (item.fundType === 'T1' ? 'T+1' : 'T+0'),
      status: item.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    });
  }

  return {
    id: String(data.id),
    symbolCode: String(data.symbol_code),
    symbolName: String(data.symbol_name),
    actualSymbol: String(data.actual_symbol),
    emailContact: data.email_contact ? String(data.email_contact) : '',
    navUnitPrice: Number(data.nav_unit_price) || 0,
    fundType: data.fund_type as import('../types').SettlementType,
    status: data.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CLOSED',
    scheduleFrequency: item.scheduleFrequency || 'DAILY',
    executionInstruction: item.executionInstruction || (item.fundType === 'T1' ? 'T+1' : 'T+0'),
    createdAt: String(data.created_at || new Date().toISOString()),
  };
}

/**
 * Updates an existing reference data record in PostgreSQL and syncs fund_schedules.
 */
export async function updateReferenceDataInDb(
  item: ReferenceData
): Promise<ReferenceData> {
  const supabase = await getDbClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id);

  let query = supabase
    .from('reference_data')
    .update({
      symbol_code: item.symbolCode.trim(),
      symbol_name: item.symbolName.trim(),
      actual_symbol: item.actualSymbol.trim(),
      email_contact: item.emailContact?.trim() || null,
      nav_unit_price: item.navUnitPrice || 0,
      fund_type: item.fundType || 'T0',
      status: item.status || 'ACTIVE',
    });

  if (isUuid) {
    query = query.eq('id', item.id);
  } else {
    query = query.eq('symbol_code', item.symbolCode.trim());
  }

  const { data, error } = await query.select().single();

  if (error) {
    throw new Error(`[DB ERROR] updateReferenceDataInDb: ${error.message}`);
  }

  const symbolKey = item.symbolCode.trim();
  const { data: existingSched } = await supabase
    .from('fund_schedules')
    .select('id')
    .eq('fund_code', symbolKey)
    .limit(1);

  if (existingSched && existingSched.length > 0) {
    await supabase
      .from('fund_schedules')
      .update({
        fund_type: item.fundType || 'T0',
        frequency: item.scheduleFrequency || 'DAILY',
        raw_instruction: item.executionInstruction || '',
        status: item.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      })
      .eq('id', existingSched[0].id);
  } else if (item.scheduleFrequency || item.executionInstruction) {
    await supabase.from('fund_schedules').insert({
      fund_code: symbolKey,
      fund_type: item.fundType || 'T0',
      frequency: item.scheduleFrequency || 'DAILY',
      raw_instruction: item.executionInstruction || '',
      status: item.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    });
  }

  return {
    id: String(data.id),
    symbolCode: String(data.symbol_code),
    symbolName: String(data.symbol_name),
    actualSymbol: String(data.actual_symbol),
    emailContact: data.email_contact ? String(data.email_contact) : '',
    navUnitPrice: Number(data.nav_unit_price) || 0,
    fundType: data.fund_type as import('../types').SettlementType,
    status: data.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CLOSED',
    scheduleFrequency: item.scheduleFrequency || 'DAILY',
    executionInstruction: item.executionInstruction || (item.fundType === 'T1' ? 'T+1' : 'T+0'),
    createdAt: String(data.created_at || new Date().toISOString()),
  };
}

/**
 * Toggles reference data status (ACTIVE vs ARCHIVED).
 */
export async function archiveReferenceDataInDb(
  id: string,
  status: 'ACTIVE' | 'ARCHIVED'
): Promise<boolean> {
  const supabase = await getDbClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  let query = supabase.from('reference_data').update({ status });
  if (isUuid) {
    query = query.eq('id', id);
  } else {
    query = query.eq('symbol_code', id);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`[DB ERROR] archiveReferenceDataInDb: ${error.message}`);
  }
  return true;
}

/**
 * Permanently deletes a reference data record.
 */
export async function deleteReferenceDataInDb(id: string): Promise<boolean> {
  const supabase = await getDbClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  let query = supabase.from('reference_data').delete();
  if (isUuid) {
    query = query.eq('id', id);
  } else {
    query = query.eq('symbol_code', id);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`[DB ERROR] deleteReferenceDataInDb: ${error.message}`);
  }
  return true;
}

/**
 * Bulk upserts reference data items (ON CONFLICT symbol_code DO UPDATE) safely.
 * Non-destructive: preserves existing fund_type, prices, emails, and fund schedules
 * if the uploaded file does not specify them.
 */
export async function upsertReferenceDataBatchInDb(
  items: Omit<ReferenceData, 'id'>[],
  userId?: string
): Promise<{ processed: number; count: number }> {
  if (!items || items.length === 0) return { processed: 0, count: 0 };
  const supabase = await getDbClient();

  // Deduplicate by symbolCode keeping latest
  const map = new Map<string, Omit<ReferenceData, 'id'>>();
  for (const item of items) {
    const code = item.symbolCode.trim();
    if (code) {
      map.set(code.toLowerCase(), item);
    }
  }
  const uniqueItems = Array.from(map.values());
  const symbolCodes = uniqueItems.map((u) => u.symbolCode.trim());

  // Fetch existing reference records to avoid destroying existing attributes
  const { data: existingRefs } = await supabase
    .from('reference_data')
    .select('symbol_code, fund_type, nav_unit_price, email_contact, status')
    .in('symbol_code', symbolCodes);

  const existingMap = new Map<
    string,
    {
      symbol_code: string;
      fund_type: string;
      nav_unit_price: number;
      email_contact: string | null;
      status: string;
    }
  >();

  if (existingRefs) {
    for (const r of existingRefs) {
      if (r.symbol_code) {
        existingMap.set(String(r.symbol_code).trim().toLowerCase(), {
          symbol_code: String(r.symbol_code),
          fund_type: String(r.fund_type || 'T0'),
          nav_unit_price: Number(r.nav_unit_price) || 0,
          email_contact: r.email_contact ? String(r.email_contact) : null,
          status: String(r.status || 'ACTIVE'),
        });
      }
    }
  }

  const records = uniqueItems.map((item) => {
    const code = item.symbolCode.trim();
    const existing = existingMap.get(code.toLowerCase());

    // Preserve existing fund_type if item does not have an explicit fundType specified
    const fundType = item.fundType || existing?.fund_type || 'T0';

    // Preserve existing nav_unit_price if incoming price is 0 or absent, but DB has > 0
    const navUnitPrice =
      item.navUnitPrice && item.navUnitPrice > 0
        ? item.navUnitPrice
        : existing?.nav_unit_price || 0;

    // Preserve existing email if incoming is empty
    const emailContact =
      item.emailContact && item.emailContact.trim() !== ''
        ? item.emailContact.trim()
        : existing?.email_contact || null;

    const status = item.status || existing?.status || 'ACTIVE';

    return {
      symbol_code: code,
      symbol_name: item.symbolName.trim(),
      actual_symbol: item.actualSymbol.trim(),
      email_contact: emailContact,
      nav_unit_price: navUnitPrice,
      fund_type: fundType,
      status: status,
      created_by: userId || null,
    };
  });

  const { error } = await supabase
    .from('reference_data')
    .upsert(records, { onConflict: 'symbol_code' });

  if (error) {
    throw new Error(`[DB ERROR] upsertReferenceDataBatchInDb: ${error.message}`);
  }

  // Update fund_schedules ONLY if frequency, instruction or fundType are provided
  for (const item of uniqueItems) {
    const code = item.symbolCode.trim();
    const hasInstruction = Boolean(item.executionInstruction && item.executionInstruction.trim() !== '');
    const hasFrequency = Boolean(item.scheduleFrequency && item.scheduleFrequency.trim() !== '');
    const hasFundType = Boolean(item.fundType && item.fundType.trim() !== '');

    if (hasInstruction || hasFrequency || hasFundType) {
      const { data: existing } = await supabase
        .from('fund_schedules')
        .select('id, fund_type, frequency, raw_instruction')
        .eq('fund_code', code)
        .limit(1);

      if (existing && existing.length > 0) {
        const existingRow = existing[0];
        const updatePayload: Record<string, string> = {};

        if (item.fundType) updatePayload.fund_type = item.fundType;
        if (item.scheduleFrequency) updatePayload.frequency = item.scheduleFrequency;
        if (item.executionInstruction) updatePayload.raw_instruction = item.executionInstruction;
        if (item.status) updatePayload.status = item.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('fund_schedules')
            .update(updatePayload)
            .eq('id', existingRow.id);
        }
      } else {
        await supabase.from('fund_schedules').insert({
          fund_code: code,
          fund_type: item.fundType || 'T0',
          frequency: item.scheduleFrequency || 'DAILY',
          raw_instruction: item.executionInstruction || '',
          status: item.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
        });
      }
    }
  }

  return { processed: uniqueItems.length, count: uniqueItems.length };
}

/**
 * Restores canonical master data for all 68 funds from the operations specification.
 * Restores exact Arabic execution instructions, frequencies, settlement types (T0 vs T1),
 * while safely preserving any existing live NAV prices > 0.
 */
export async function restoreCanonicalMasterDataInDb(
  userId?: string
): Promise<{ restoredCount: number }> {
  const supabase = await getDbClient();

  // 1. Fetch existing NAV prices from DB so we don't wipe them to 0
  const { data: existingRefData } = await supabase
    .from('reference_data')
    .select('symbol_code, nav_unit_price');

  const priceMap = new Map<string, number>();
  if (existingRefData) {
    for (const r of existingRefData) {
      if (r.symbol_code && Number(r.nav_unit_price) > 0) {
        priceMap.set(String(r.symbol_code).trim().toLowerCase(), Number(r.nav_unit_price));
      }
    }
  }

  // 2. Prepare canonical reference_data records
  const refRecords = CANONICAL_FUNDS.map((f) => ({
    symbol_code: f.symbolCode.trim(),
    symbol_name: f.symbolName.trim(),
    actual_symbol: f.actualSymbol.trim(),
    email_contact: f.emailContact?.trim() || null,
    nav_unit_price: priceMap.get(f.symbolCode.trim().toLowerCase()) ?? f.navUnitPrice ?? 0,
    fund_type: f.fundType,
    status: f.status,
    created_by: userId || null,
  }));

  const { error: refErr } = await supabase
    .from('reference_data')
    .upsert(refRecords, { onConflict: 'symbol_code' });

  if (refErr) {
    throw new Error(`[DB ERROR] restoreCanonicalMasterDataInDb (reference_data): ${refErr.message}`);
  }

  // 3. Re-insert / Upsert canonical fund_schedules
  const { data: existingScheds } = await supabase
    .from('fund_schedules')
    .select('id, fund_code');

  const schedIdMap = new Map<string, string>();
  if (existingScheds) {
    for (const s of existingScheds) {
      if (s.fund_code) {
        schedIdMap.set(String(s.fund_code).trim().toLowerCase(), String(s.id));
      }
    }
  }

  for (const f of CANONICAL_FUNDS) {
    const existingId = schedIdMap.get(f.symbolCode.trim().toLowerCase());
    const payload = {
      fund_code: f.symbolCode.trim(),
      fund_type: f.fundType,
      frequency: f.scheduleFrequency,
      raw_instruction: f.executionInstruction,
      status: f.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    };

    if (existingId) {
      await supabase
        .from('fund_schedules')
        .update(payload)
        .eq('id', existingId);
    } else {
      await supabase
        .from('fund_schedules')
        .insert(payload);
    }
  }

  return { restoredCount: CANONICAL_FUNDS.length };
}

