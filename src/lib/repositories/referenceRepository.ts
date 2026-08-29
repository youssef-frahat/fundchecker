// Reference Repository - Database Access for Reference Data, Fund Master & Dynamic Rules
// PRODUCTION MODE: No mock fallbacks. All data must come from the database.

import { getDbClient } from '../db-client';
import { Fund, FundRule, ReferenceData } from '../types';

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

