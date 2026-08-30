-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL - PART 5: OPERATIONAL CHECKLISTS OVERHAUL
-- Professional Institutional English Titles with Arabic Operational Descriptions
-- ====================================================================

-- 1. ADD SUPER ADMIN APPROVAL COLUMNS
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 2. ENSURE CHECKLIST CODE UNIQUE CONSTRAINT
ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS uq_checklist_code;
ALTER TABLE public.checklists ADD CONSTRAINT uq_checklist_code UNIQUE (checklist_code);

-- 3. UPSERT THE 7 INSTITUTIONAL OPERATIONAL STEPS
INSERT INTO public.checklists (checklist_code, title, description, due_time, priority, mandatory, is_completed, is_approved) VALUES
('CHK-01', 'Fund Daily NAV & Valuation Price Verification', 'التحقق من أسعار وثائق صناديق الاستثمار وقيم صافي الأصول (NAV) المعلنة ومطابقتها قبل بدء تنفيذ العمليات.', '10:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-02', 'Morning T+1 Equity Orders Acceptance & Broker Routing', 'مراجعة وقبول أوامر التداول الصباحية لصناديق الأسهم (T+1) وإرسالها رسمياً لشركات السمسرة والوسطاء المنفذين.', '11:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-03', 'Pre-Market T+1 Execution Confirmation & Broker Approvals Sign-off', 'التأكد من اعتماد ومطابقة جميع أوامر T+1 المنفذة من الوسطاء واستلام إخطارات القبول والاعتماد الكاملة بدون أي رفض.', '11:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-04', 'Master Orders Dispatch to Fund Administration & Custody Services (T+0 / T+1)', 'إرسال ملف الأوامر الشامل (المهمة الرئيسية) لخدمات إدارة الصناديق وأمناء الحفظ لتسوية وتأكيد عمليات الصناديق النقدية والأسهم.', '12:30', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-05', 'Order Status Reconciliation: Acceptance to Final Operational Approval', 'المطابقة الرقابية لتحويل كافة أوامر التداول من حالة القبول المبدئي (Accept) إلى حالة الاعتماد النهائي (Approved) على المنظومة.', '13:00', 'HIGH', TRUE, FALSE, FALSE),
('CHK-06', 'Net Cash Settlement & Inter-Fund Bank Transfer Approval', 'مراجعة واعتماد صافي مبالغ التحويلات النقدية (Netting) بين الصناديق وحسابات البنوك واعتماد التحويلات النهائية قبل موعد الإقفال البنكي.', '13:30', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-07', 'End-of-Day Ledger Posting & Operational Settlement Sign-off', 'المراجعة النهائية لترحيل كافة قيود التسوية (Posting) وتأكيد الإقفال التام لليوم التشغيلي (Complete Execution Sign-off).', '14:30', 'CRITICAL', TRUE, FALSE, FALSE)
ON CONFLICT (checklist_code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    due_time = EXCLUDED.due_time,
    priority = EXCLUDED.priority,
    mandatory = EXCLUDED.mandatory;

-- 4. RLS POLICIES FOR CHECKLISTS
GRANT ALL ON public.checklists TO anon, authenticated;
DROP POLICY IF EXISTS anon_checklists_all ON public.checklists;
CREATE POLICY anon_checklists_all ON public.checklists FOR ALL TO anon USING (true) WITH CHECK (true);
