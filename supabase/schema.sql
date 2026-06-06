/* Supabase schema for Mediflow SaaS */

-- Enable pgcrypto for UUID generation
create extension if not exists "pgcrypto";

-- 1. Patients
create table patients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone text not null unique,
    age int,
    gender text check (gender in ('Male','Female','Other')),
    abha_id text,
    created_at timestamp with time zone default now()
);

-- 2. Staff (users)
create table staff (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    role text check (role in ('compounder','doctor','lab','pharmacy')) not null,
    email text unique,
    phone text,
    created_at timestamp with time zone default now()
);

-- 3. Appointments
create table appointments (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references patients(id) on delete cascade,
    doctor_id uuid references staff(id) on delete set null,
    status text check (status in ('pending_payment','ready_for_consult','completed','scheduled')) default 'pending_payment',
    appointment_time timestamp with time zone,
    end_time timestamp with time zone,
    created_at timestamp with time zone default now()
);

-- 4. Invoices
create table invoices (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid references appointments(id) on delete cascade,
    type text check (type in ('consult','lab','pharmacy')) not null,
    amount numeric not null,
    status text check (status in ('unpaid','paid')) default 'unpaid',
    created_at timestamp with time zone default now()
);

-- 5. Lab Reports
create table lab_reports (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid references appointments(id) on delete cascade,
    file_url text not null,
    summary_text text,
    created_at timestamp with time zone default now()
);

-- 6. Prescriptions
create table prescriptions (
    id uuid primary key default gen_random_uuid(),
    appointment_id uuid references appointments(id) on delete cascade,
    medicines jsonb not null,
    created_at timestamp with time zone default now()
);

-- 7. Audit Log
create table audit_log (
    id uuid primary key default gen_random_uuid(),
    action text not null,
    user_id uuid references staff(id),
    details jsonb,
    timestamp timestamp with time zone default now()
);

/* Row Level Security (RLS) */
alter table patients enable row level security;
alter table staff enable row level security;
alter table appointments enable row level security;
alter table invoices enable row level security;
alter table lab_reports enable row level security;
alter table prescriptions enable row level security;
alter table audit_log enable row level security;

-- Policies per role
-- Compounder can select/insert/update/delete everywhere
create policy "compounder_all" on patients for all to public using (auth.role() = 'compounder');
create policy "compounder_all_staff" on staff for all to public using (auth.role() = 'compounder');
create policy "compounder_all_appointments" on appointments for all to public using (auth.role() = 'compounder');
create policy "compounder_all_invoices" on invoices for all to public using (auth.role() = 'compounder');
create policy "compounder_all_lab" on lab_reports for all to public using (auth.role() = 'compounder');
create policy "compounder_all_presc" on prescriptions for all to public using (auth.role() = 'compounder');

-- Doctor can view own appointments & patients, update notes (not in schema yet)
create policy "doctor_appointments" on appointments for select, update to public using (auth.role() = 'doctor' and doctor_id = auth.uid());
create policy "doctor_patients" on patients for select to public using (auth.role() = 'doctor');

-- Lab can view only paid lab invoices & reports
create policy "lab_paid_reports" on lab_reports for select to public using (
    auth.role() = 'lab' and (
        exists (select 1 from invoices where invoices.appointment_id = lab_reports.appointment_id and invoices.type = 'lab' and invoices.status = 'paid')
    )
);

-- Pharmacy can view only paid pharmacy invoices (read‑only)
create policy "pharmacy_paid_invoices" on invoices for select to public using (
    auth.role() = 'pharmacy' and type = 'pharmacy' and status = 'paid'
);

-- Audit log: only compounder can insert, all can read own actions
create policy "audit_insert" on audit_log for insert to public using (auth.role() = 'compounder');
create policy "audit_select" on audit_log for select to public using (auth.role() = 'compounder' or user_id = auth.uid());
