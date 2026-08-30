-- ====================================================================
-- SUPABASE POSTGRESQL PRODUCTION DDL - PART 5: OPERATIONAL CHECKLISTS OVERHAUL
-- Implements the 7 Real Daily Operational Steps with Two-Tier Sign-Off
-- ====================================================================

-- 1. ADD SUPER ADMIN APPROVAL COLUMNS
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_by_name VARCHAR(255);
ALTER TABLE public.checklists ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- 2. ENSURE CHECKLIST CODE UNIQUE CONSTRAINT
ALTER TABLE public.checklists DROP CONSTRAINT IF EXISTS uq_checklist_code;
ALTER TABLE public.checklists ADD CONSTRAINT uq_checklist_code UNIQUE (checklist_code);

-- 3. REMOVE OLD GENERIC CHECKLISTS
DELETE FROM public.checklists;

-- 4. INSERT THE 7 CANONICAL OPERATIONAL STEPS
INSERT INTO public.checklists (checklist_code, title, description, due_time, priority, mandatory, is_completed, is_approved) VALUES
('CHK-01', 'شيك أسعار الصناديق (Fund Daily NAV & Prices Check)', 'التحقق من أسعار وثائق الصناديق اليومية وإدخالها على المنظومة قبل موعد الإقفال.', '10:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-02', 'قبول وإرسال أوردرات الصباح T1 (Morning T1 Orders Dispatch)', 'مراجعة وقبول وإرسال جميع أوامر الشراء والبيع الصباحية لصناديق T1 من طرفنا إلى البورصة والوسطاء.', '11:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-03', 'تأكيد اعتماد جميع أوردرات T1 (T1 Orders Full Approval Verification)', 'التأكد التام من أن كافة أوامر صناديق T1 تم اعتمادها والموافقة عليها بالكامل بدون أي رفض.', '11:00', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-04', 'إرسال الأوردرات لخدمات الإدارة T0 و T1 - Main Work (Management Services Dispatch)', 'إرسال ملف الأوردرات الشامل لخدمات الإدارة وأمناء الحفظ للصناديق النقدية وأسهم الاستثمار.', '12:30', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-05', 'مراجعة التحويل التام من Accept إلى Approve (Status Transition Audit)', 'مطابقة ومراجعة تحويل كافة العمليات من حالة القبول (Accept) إلى الاعتماد النهائي (Approve).', '13:00', 'HIGH', TRUE, FALSE, FALSE),
('CHK-06', 'مراجعة الاعتمادات والتحويلات النقدية (Netting & Cash Transfers Review)', 'مراجعة صافي التحويلات النقدية (System Net Transfers) وإجراء أي تسويات يدوية قبل اعتماد البنك.', '13:30', 'CRITICAL', TRUE, FALSE, FALSE),
('CHK-07', 'مراجعة الترحيل والإقفال النهائي (Post & Complete Execution Audit)', 'المراجعة النهائية لترحيل العمليات (Post) وإقفال اليوم التشغيلي لجميع الصناديق (Complete).', '14:30', 'CRITICAL', TRUE, FALSE, FALSE)
ON CONFLICT (checklist_code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    due_time = EXCLUDED.due_time,
    priority = EXCLUDED.priority,
    mandatory = EXCLUDED.mandatory;

-- 5. RLS POLICIES FOR CHECKLISTS
GRANT ALL ON public.checklists TO anon, authenticated;
DROP POLICY IF EXISTS anon_checklists_all ON public.checklists;
CREATE POLICY anon_checklists_all ON public.checklists FOR ALL TO anon USING (true) WITH CHECK (true);
