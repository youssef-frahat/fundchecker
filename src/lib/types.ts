// Investment Management Platform - Commercial Enterprise Domain Models

export type UserRole = 'SUPER_ADMIN' | 'OPERATIONS_USER' | 'TRADING_OPERATOR' | 'OPERATIONS_CHECKER' | 'AUDITOR';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  lastLoginAt?: string;
  createdAt: string;
}

export type SettlementType = 'T0' | 'T1' | 'T2' | 'T3' | 'DVP' | string;

export interface Fund {
  id: string;
  fundCode: string; // e.g. "1001", "AHLAC"
  fundName: string; // e.g. "AZ - ADKHAR"
  fundType: SettlementType; // "T0", "T1", "T2", "DVP"
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CLOSED';
  createdAt: string;
}

export interface FundRule {
  id: string;
  fundType: SettlementType;
  orderSide: 'BUY' | 'SELL';
  isTransactionValueVisible: boolean;
  isQuantityVisible: boolean;
}

export interface ReferenceData {
  id: string;
  symbolCode: string;     // الرمز (e.g. "1006")
  symbolName: string;     // الاسم (e.g. "Aafaq Investment Fund")
  actualSymbol: string;   // الرمز2 (e.g. "AFAC")
  emailContact?: string;  // Email for future notifications
  navUnitPrice: number;   // سعر الوثيقة الواحدة
  fundType: SettlementType; // PROC-3: T0/T1/T2/DVP — used for rule evaluation
  fundId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'CLOSED';
  scheduleFrequency?: string;
  executionInstruction?: string;
}

export interface RawTransactionRow {
  id: string;
  fileId: string;
  requestId: string;         // Col A: Request Id
  mubasherNo: string;        // Col B: Mubasher No
  customerName: string;      // Col C: Customer Name
  orderSide: 'BUY' | 'SELL' | string; // Col D: Order Side
  symbol: string;            // Col E: Symbol
  symbolDescription: string; // Col F: Symbol Description (Product Name)
  orderStatus?: string;      // Col G
  allocatedQuantity?: number;// Col 35: Allocated Quantity
  bookKeeper?: string;       // Col H
  currency?: string;         // Col I
  quantity: number;          // Col J: Quantity
  price: number;             // Col K: Price
  orderValue: number;        // Col L: Order Value
  totalCommission?: number;  // Col M
  netSettle?: number;        // Col N
  cashAccountNo?: string;    // Col O
  isinCode?: string;         // Col R
  orderDate: string;
}

export interface GeneratedTransactionRow {
  transactionId: string;      // Transaction ID (Request Id)
  transactionType: 'buy' | 'sell'; // Transaction Type
  transactionDate: string;    // m/d/yyyy
  externalCode: string;       // Mubasher No
  name: string;               // Customer Name
  transactionValue: number | null; // Order Value (Subject to T0/T1 rule)
  qty: number | null;              // Quantity (Subject to T0/T1 rule)
  branchId: number;           // Constant 1
  valueDate: string;          // m/d/yyyy
  icPrice: number;            // Price
  fees: number;               // Constant 0
  productName: string;        // Symbol Description for tab grouping
}

export interface NettingRow {
  symbolCode: string;
  symbolName: string;
  actualSymbol: string;
  buyTotal: number;
  sellTotal: number;
  netAmount: number; // sellTotal - buyTotal
  currency: 'EGP' | 'USD';
  status: 'NEUTRAL' | 'POSITIVE' | 'NEGATIVE';
  reviewStatus: 'DRAFT' | 'UNDER_REVIEW' | 'APPROVED';
  makerName?: string;
  checkerName?: string;
  approvedAt?: string;
  digitalDeclarationSigned?: boolean;
}

export interface ReviewApproval {
  id: string;
  entityType: 'TRANSFER_SHEET' | 'TRANSACTION_REPORT' | 'CHECKLIST';
  entityId: string;
  makerUserId: string;
  makerUserName: string;
  makerCompletedAt: string;
  checkerUserId?: string;
  checkerUserName?: string;
  checkerApprovedAt?: string;
  status: 'PENDING' | 'COMPLETED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  reopenedBy?: string;
  reopenedAt?: string;
  reopenReason?: string;
  digitalDeclarationText?: string;
}

export interface UploadedFileRecord {
  id: string;
  fileName: string;
  fileHashSha256: string;
  fileSize: number;
  rowCount: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  fileCategory?: 'ORDERS' | 'ALLOCATION';
  status: 'PROCESSING' | 'PARSED' | 'EXCEPTION' | 'FAILED' | 'APPROVED' | 'ARCHIVED';
}

export interface ExceptionRecord {
  id: string;
  fileId: string;
  fileName: string;
  exceptionType: 'UNKNOWN_SYMBOL' | 'UNKNOWN_ISIN' | 'DUPLICATE_TRADE' | 'SCHEMATIC_ERR' | 'DUPLICATE_UPLOAD';
  errorMessage: string;
  rawPayload?: Record<string, unknown>;
  status: 'OPEN' | 'ASSIGNED' | 'RESOLVED' | 'IGNORED';
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  description?: string;
  dueTime: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mandatory: boolean;
  isCompleted: boolean;
  completedBy?: string;
  completedByName?: string;
  completedAt?: string;
  reopenedBy?: string;
  reopenedByName?: string;
  reopenedAt?: string;
  reopenReason?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityName: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress: string;
  timestampUtc: string;
}

export interface SystemHealthMetric {
  dbLatencyMs: number;
  memoryUsageMb: number;
  supabaseStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  lastBackupAt: string;
  activeConnections: number;
}

export type TransferBatchStatus = 'DRAFT' | 'MODIFIED' | 'PENDING_REVIEW' | 'APPROVED' | 'LOCKED';

export interface TransferSheetBatch {
  id: string;
  batchNumber: string;
  allocationFileId: string;
  businessDate: string;
  status: TransferBatchStatus;
  totalBuyAmount: number;
  totalSellAmount: number;
  totalNetAmount: number;
  makerId: string;
  makerName?: string;
  checkerId?: string;
  checkerName?: string;
  rejectionReason?: string;
  approvedAt?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
  lines?: TransferSheetLine[];
}

export type AdjustmentCategory = 
  | 'BANK_FEE'
  | 'SETTLEMENT_DIFFERENCE'
  | 'CUSTODIAN_CORRECTION'
  | 'MANUAL_ADJUSTMENT'
  | 'OTHER';

export interface TransferSheetLine {
  id: string;
  batchId: string;
  symbolCode: string;
  symbolName: string;
  actualSymbol?: string;
  systemBuyAmount: number;     // Immutable market execution
  systemSellAmount: number;    // Immutable market execution
  systemNetAmount: number;     // systemSellAmount - systemBuyAmount
  adjustmentAmount: number;    // Only field edited by operations (default 0)
  adjustmentCategory?: AdjustmentCategory;
  adjustmentReason?: string;
  finalTransferAmount: number; // systemNetAmount + adjustmentAmount
  isManuallyAdjusted: boolean;
  adjustments?: TransferLineAdjustment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface TransferLineAdjustment {
  id: string;
  batchId: string;
  lineId: string;
  symbolCode: string;
  systemNetSnapshot: number;
  oldAdjustmentAmount: number;
  newAdjustmentAmount: number;
  delta: number;
  resultingFinalTransfer: number;
  adjustmentCategory: AdjustmentCategory;
  reason: string;
  userId: string;
  userName: string;
  clientIp: string;
  timestampUtc: string;
}

export interface FundSchedule {
  id: string;
  scheduleName: string;
  patternType: 'DAY_OF_MONTH' | 'NTH_WEEKDAY' | 'COMPOUND_WEEKDAY' | 'LAST_WEEKDAY' | 'DAILY' | 'CUSTOM';
  dayOfMonth?: number;
  weekdayIndex?: number;
  weekOccurrences?: number[];
  isActive: boolean;
  createdAt?: string;
}

export interface ScheduleReminderItem {
  id: string;
  fundCode: string;
  fundName: string;
  type: 'NOTICE_DUE' | 'EXECUTION_DUE';
  title: string;
  message: string;
  rawInstruction: string;
  cutoffTime?: string;
  urgency: 'HIGH' | 'MEDIUM' | 'INFO';
}
