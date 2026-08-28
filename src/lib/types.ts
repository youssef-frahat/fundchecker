// Investment Management Platform - Commercial Enterprise Domain Models

export type UserRole = 'SUPER_ADMIN' | 'OPERATIONS_USER';

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
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
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
  fundId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
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
  status: 'PROCESSING' | 'PARSED' | 'EXCEPTION' | 'APPROVED' | 'ARCHIVED';
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
