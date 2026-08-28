// Application Central Store & Seed Data (Extracted from Provided User Reference Sheets)

import {
  AuditLog,
  ChecklistItem,
  ExceptionRecord,
  Fund,
  FundRule,
  ReferenceData,
  ReviewApproval,
  User,
} from './types';
import { DEFAULT_FUND_RULES } from './rule-engine';

// Initial Users
export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin-1',
    email: 'admin@investment.com',
    fullName: 'Super Administrator',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-ops-1',
    email: 'ops.maker@investment.com',
    fullName: 'Ahmed Hassan (Maker)',
    role: 'OPERATIONS_USER',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'user-ops-2',
    email: 'ops.checker@investment.com',
    fullName: 'Mariam Ali (Checker)',
    role: 'OPERATIONS_USER',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// Reference Data extracted from User's Screenshot 2
export const INITIAL_REFERENCE_DATA: ReferenceData[] = [
  { id: 'ref-1006', symbolCode: '1006', symbolName: 'Aafaq Investment Fund', actualSymbol: 'AFAC', emailContact: 'Afaq Fund', navUnitPrice: 264.2139, status: 'ACTIVE' },
  { id: 'ref-ahlac', symbolCode: 'AHLAC', symbolName: 'AHLY A. CONTRACTORS FUND', actualSymbol: 'AHLAC', emailContact: 'Tamayoz MMF', navUnitPrice: 17.3411, status: 'ACTIVE' },
  { id: 'ref-alhayah', symbolCode: 'Al Hayah', symbolName: 'Al Hayah', actualSymbol: 'AlHayah', emailContact: 'AlHayah - Hayat', navUnitPrice: 0, status: 'ACTIVE' },
  { id: 'ref-almezan', symbolCode: 'Almezan', symbolName: 'Almezan', actualSymbol: 'Almezan', emailContact: 'Al Mizan', navUnitPrice: 0, status: 'ACTIVE' },
  { id: 'ref-arup', symbolCode: 'ARUP', symbolName: 'Arupe Cumulative Fund', actualSymbol: 'AROPE', emailContact: 'AROPE Insurance Misr Fund', navUnitPrice: 0, status: 'ACTIVE' },
  { id: 'ref-1004', symbolCode: '1004', symbolName: 'Ataa Charity Fund', actualSymbol: 'ATAA', emailContact: 'Ataa Fund', navUnitPrice: 0, status: 'ACTIVE' },
  { id: 'ref-1001', symbolCode: '1001', symbolName: 'AZ - ADKHAR', actualSymbol: 'ADKHAR-AZ', emailContact: 'ادخار / AZFI', navUnitPrice: 21.13012, status: 'ACTIVE' },
  { id: 'ref-1010', symbolCode: '1010', symbolName: 'AZ - FORAS', actualSymbol: 'Azimut Stocks', emailContact: 'Azimut Equity Opportunity Fund', navUnitPrice: 52.42922, status: 'ACTIVE' },
  { id: 'ref-1012', symbolCode: '1012', symbolName: 'AZ- ESTEHKAK - USD', actualSymbol: 'STRC', emailContact: 'Azimut Target Maturity - USD', navUnitPrice: 10.50541, status: 'ACTIVE' },
  { id: 'ref-goldaz', symbolCode: 'GOLD AZ', symbolName: 'AZIMUT GOLD', actualSymbol: 'Gold AZ', emailContact: 'AZ-GOLD', navUnitPrice: 25.2991, status: 'ACTIVE' },
  { id: 'ref-sabayek', symbolCode: 'Sabayek', symbolName: 'Beltone Evolve Gold Fund', actualSymbol: 'Sabayek', emailContact: 'Sabayek', navUnitPrice: 1.77656, status: 'ACTIVE' },
  { id: 'ref-1016', symbolCode: '1016', symbolName: 'Cash Mubasher Fund', actualSymbol: 'CashMubasher', emailContact: 'Cash Mubasher Fund Price', navUnitPrice: 24.03852, status: 'ACTIVE' },
  { id: 'ref-ciam-building', symbolCode: 'CIAM Building', symbolName: 'CIAM Building', actualSymbol: 'CIAM Building', emailContact: 'CIAM Sectors Prices - CIAM Building', navUnitPrice: 21.46952, status: 'ACTIVE' },
  { id: 'ref-1018', symbolCode: '1018', symbolName: 'HORUS FUND', actualSymbol: 'Horus', emailContact: 'Horas MM', navUnitPrice: 20.89333, status: 'ACTIVE' },
  { id: 'ref-kenzshariaa', symbolCode: 'kenzshariaa', symbolName: 'KENZSHARIAA', actualSymbol: 'KENZSHARIAA', emailContact: 'Kenz-Shareiaa - KENZSHARIAA', navUnitPrice: 181.07, status: 'ACTIVE' },
  { id: 'ref-1021', symbolCode: '1021', symbolName: 'Misr Al-Youm', actualSymbol: 'Misr Al-Youm', emailContact: 'Misr Al-Youm', navUnitPrice: 19.40342, status: 'ACTIVE' },
  { id: 'ref-1014', symbolCode: '1014', symbolName: 'Misr Takaful Money Market', actualSymbol: 'Misr Takaful', emailContact: 'Misr Takaful Fund', navUnitPrice: 212.05923, status: 'ACTIVE' },
  { id: 'ref-mubasher-eq', symbolCode: 'Mubasher Equity Fund', symbolName: 'Mubasher Equity Fund', actualSymbol: 'Mubasher Equity', emailContact: 'Mubasher Equity Fund Price', navUnitPrice: 2.0182, status: 'ACTIVE' },
  { id: 'ref-mubasher-gold', symbolCode: 'Mubasher Gold', symbolName: 'Mubasher Gold', actualSymbol: 'Mubasher Gold', emailContact: 'Dahab Mubasher - Mubasher Gold', navUnitPrice: 13.0276, status: 'ACTIVE' },
  { id: 'ref-1005', symbolCode: '1005', symbolName: 'NI Capital Money Market', actualSymbol: 'NICapital', emailContact: 'SIULA fund - NI MM FUND', navUnitPrice: 24.54846, status: 'ACTIVE' },
  { id: 'ref-odin-iv', symbolCode: 'ODIN IV', symbolName: 'ODIN IV', actualSymbol: 'ODIN IV', emailContact: 'ODIN MMF', navUnitPrice: 1.25639, status: 'ACTIVE' },
  { id: 'ref-shariaa', symbolCode: 'Shariah Compliant Fund', symbolName: 'Shariah Compliant Fund', actualSymbol: 'Shariah Compliant Fund', emailContact: 'Misr Shariaa Equity Price', navUnitPrice: 22.42274, status: 'ACTIVE' },
  { id: 'ref-thrawat-100', symbolCode: '100-100', symbolName: 'Tharawat 100/100', actualSymbol: 'Tharawat - 100/100', emailContact: 'Beltone EGX100 - Tharawat 100/100', navUnitPrice: 2.56203, status: 'ACTIVE' },
  { id: 'ref-wafra', symbolCode: 'Wafra', symbolName: 'Tharawat Wafra', actualSymbol: 'Tharawat - Wafra', emailContact: 'Beltone EGX33 - Tharawat Wafra', navUnitPrice: 2.18483, status: 'ACTIVE' },
  { id: 'ref-1011', symbolCode: '1011', symbolName: 'Wethaq Investment', actualSymbol: 'IEIG', emailContact: 'Wethaq M.M', navUnitPrice: 23.4454, status: 'ACTIVE' },
];

export const INITIAL_FUNDS: Fund[] = INITIAL_REFERENCE_DATA.map((r, idx) => ({
  id: `fund-${idx + 1}`,
  fundCode: r.symbolCode,
  fundName: r.symbolName,
  fundType: idx % 4 === 0 ? 'T1' : 'T0',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
}));

export const INITIAL_CHECKLISTS: ChecklistItem[] = [
  {
    id: 'chk-1',
    checklistId: 'c-1',
    title: 'Daily Trade File Upload & Hash Verification',
    description: 'Verify 39-column schema integrity and SHA-256 duplicate status.',
    dueTime: '09:30',
    priority: 'CRITICAL',
    mandatory: true,
    isCompleted: true,
    completedBy: 'user-ops-1',
    completedByName: 'Ahmed Hassan (Maker)',
    completedAt: '2026-08-28T09:15:00Z',
  },
  {
    id: 'chk-2',
    checklistId: 'c-1',
    title: 'T0 / T1 Fund Transaction File Generation',
    description: 'Execute dynamic rule engine for all active funds in alphabetical order.',
    dueTime: '11:00',
    priority: 'HIGH',
    mandatory: true,
    isCompleted: true,
    completedBy: 'user-ops-1',
    completedByName: 'Ahmed Hassan (Maker)',
    completedAt: '2026-08-28T10:45:00Z',
  },
  {
    id: 'chk-3',
    checklistId: 'c-1',
    title: 'Transfer & Netting Sheet Maker Sign-off',
    description: 'Calculate NET = Sell - Buy and submit for 4-Eyes Checker Review.',
    dueTime: '13:00',
    priority: 'CRITICAL',
    mandatory: true,
    isCompleted: false,
  },
  {
    id: 'chk-4',
    checklistId: 'c-1',
    title: 'End of Day Operational Verification',
    description: 'Confirm zero unmapped exceptions and lock daily audit history.',
    dueTime: '16:00',
    priority: 'HIGH',
    mandatory: true,
    isCompleted: false,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    userId: 'user-admin-1',
    userName: 'Super Administrator',
    action: 'SYSTEM_BOOT',
    entityName: 'SYSTEM',
    ipAddress: '127.0.0.1',
    timestampUtc: '2026-08-28T08:00:00Z',
    newValues: { status: 'OPERATIONAL', timezone: 'UTC (Display Africa/Cairo)' },
  },
  {
    id: 'log-2',
    userId: 'user-ops-1',
    userName: 'Ahmed Hassan (Maker)',
    action: 'CHECKLIST_COMPLETE',
    entityName: 'CHECKLIST_ITEM',
    entityId: 'chk-1',
    ipAddress: '192.168.1.45',
    timestampUtc: '2026-08-28T09:15:00Z',
  },
];
