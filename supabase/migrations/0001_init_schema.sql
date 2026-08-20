-- Inventory / invoicing / delivery / purchases schema
-- Stock decrements on delivery being marked 'delivered' (not on invoice issuance).
-- Stock increments when purchase line items are recorded.

create type user_role as enum ('owner', 'employee');
create type invoice_status as enum ('draft', 'issued', 'paid', 'cancelled');
create type delivery_status as enum ('pending', 'delivered', 'cancelled');
create type stock_movement_type as enum ('purchase', 'delivery', 'adjustment');

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role user_role not null default 'employee',
  created_at timestamptz not null default now()
);

create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'employee'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- reference tables
-- ---------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  barcode text unique,
  name text not null,
  description text,
  category text,
  unit text not null default 'pcs',
  cost_price numeric(12, 2) not null default 0,
  sale_price numeric(12, 2) not null default 0,
  quantity_on_hand numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- document numbering (INV-000001, DEL-000001, PUR-000001)
-- ---------------------------------------------------------------------------
create sequence invoice_number_seq;
create sequence delivery_number_seq;
create sequence purchase_number_seq;

create function next_invoice_number()
returns text language sql as
$$ select 'INV-' || lpad(nextval('invoice_number_seq')::text, 6, '0') $$;

create function next_delivery_number()
returns text language sql as
$$ select 'DEL-' || lpad(nextval('delivery_number_seq')::text, 6, '0') $$;

create function next_purchase_number()
returns text language sql as
$$ select 'PUR-' || lpad(nextval('purchase_number_seq')::text, 6, '0') $$;

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default next_invoice_number(),
  customer_id uuid not null references customers (id),
  issued_by uuid not null references profiles (id) default auth.uid(),
  issued_at timestamptz not null default now(),
  status invoice_status not null default 'draft',
  subtotal numeric(12, 2) not null default 0,
  tax numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  product_id uuid not null references products (id),
  description text,
  quantity numeric(12, 2) not null,
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) generated always as (quantity * unit_price) stored
);

-- ---------------------------------------------------------------------------
-- delivery slips (stock decrements when status -> 'delivered')
-- ---------------------------------------------------------------------------
create table delivery_slips (
  id uuid primary key default gen_random_uuid(),
  delivery_number text not null unique default next_delivery_number(),
  customer_id uuid not null references customers (id),
  invoice_id uuid references invoices (id),
  issued_by uuid not null references profiles (id) default auth.uid(),
  issued_at timestamptz not null default now(),
  delivery_address text,
  status delivery_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now()
);

create table delivery_slip_items (
  id uuid primary key default gen_random_uuid(),
  delivery_slip_id uuid not null references delivery_slips (id) on delete cascade,
  product_id uuid not null references products (id),
  description text,
  quantity numeric(12, 2) not null
);

-- ---------------------------------------------------------------------------
-- purchases (simple: a purchase row = goods already received)
-- ---------------------------------------------------------------------------
create table purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_number text not null unique default next_purchase_number(),
  supplier_id uuid not null references suppliers (id),
  purchased_by uuid not null references profiles (id) default auth.uid(),
  purchase_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create table purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references purchases (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity numeric(12, 2) not null,
  unit_cost numeric(12, 2) not null,
  line_total numeric(12, 2) generated always as (quantity * unit_cost) stored
);

-- ---------------------------------------------------------------------------
-- stock ledger: single source of truth for quantity_on_hand
-- ---------------------------------------------------------------------------
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products (id),
  movement_type stock_movement_type not null,
  quantity_delta numeric(12, 2) not null,
  reference_type text,
  reference_id uuid,
  created_by uuid references profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create function apply_stock_movement()
returns trigger language plpgsql as $$
begin
  update products
  set quantity_on_hand = quantity_on_hand + new.quantity_delta,
      updated_at = now()
  where id = new.product_id;
  return new;
end;
$$;

create trigger on_stock_movement_insert
  after insert on stock_movements
  for each row execute function apply_stock_movement();

-- purchase line items increment stock immediately (goods already received)
create function record_purchase_stock_movement()
returns trigger language plpgsql as $$
begin
  insert into stock_movements (product_id, movement_type, quantity_delta, reference_type, reference_id)
  values (new.product_id, 'purchase', new.quantity, 'purchase', new.purchase_id);
  return new;
end;
$$;

create trigger on_purchase_item_insert
  after insert on purchase_items
  for each row execute function record_purchase_stock_movement();

-- delivery slip items decrement stock only when the slip transitions to 'delivered'
create function record_delivery_stock_movement()
returns trigger language plpgsql as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    insert into stock_movements (product_id, movement_type, quantity_delta, reference_type, reference_id)
    select item.product_id, 'delivery', -item.quantity, 'delivery_slip', item.delivery_slip_id
    from delivery_slip_items item
    where item.delivery_slip_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_delivery_slip_status_update
  after update on delivery_slips
  for each row execute function record_delivery_stock_movement();

-- ---------------------------------------------------------------------------
-- row level security: any authenticated staff member can read/write business
-- data; only 'owner' can delete or manage other users.
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table delivery_slips enable row level security;
alter table delivery_slip_items enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table stock_movements enable row level security;

create function is_owner()
returns boolean language sql stable as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'owner') $$;

create policy "profiles readable by staff" on profiles for select using (auth.uid() is not null);
create policy "profiles manageable by owner" on profiles for all using (is_owner()) with check (is_owner());

create policy "staff read products" on products for select using (auth.uid() is not null);
create policy "staff write products" on products for insert with check (auth.uid() is not null);
create policy "staff update products" on products for update using (auth.uid() is not null);
create policy "owner delete products" on products for delete using (is_owner());

create policy "staff read customers" on customers for select using (auth.uid() is not null);
create policy "staff write customers" on customers for insert with check (auth.uid() is not null);
create policy "staff update customers" on customers for update using (auth.uid() is not null);
create policy "owner delete customers" on customers for delete using (is_owner());

create policy "staff read suppliers" on suppliers for select using (auth.uid() is not null);
create policy "staff write suppliers" on suppliers for insert with check (auth.uid() is not null);
create policy "staff update suppliers" on suppliers for update using (auth.uid() is not null);
create policy "owner delete suppliers" on suppliers for delete using (is_owner());

create policy "staff read invoices" on invoices for select using (auth.uid() is not null);
create policy "staff write invoices" on invoices for insert with check (auth.uid() is not null);
create policy "staff update invoices" on invoices for update using (auth.uid() is not null);
create policy "owner delete invoices" on invoices for delete using (is_owner());

create policy "staff read invoice_items" on invoice_items for select using (auth.uid() is not null);
create policy "staff write invoice_items" on invoice_items for insert with check (auth.uid() is not null);
create policy "staff update invoice_items" on invoice_items for update using (auth.uid() is not null);
create policy "owner delete invoice_items" on invoice_items for delete using (is_owner());

create policy "staff read delivery_slips" on delivery_slips for select using (auth.uid() is not null);
create policy "staff write delivery_slips" on delivery_slips for insert with check (auth.uid() is not null);
create policy "staff update delivery_slips" on delivery_slips for update using (auth.uid() is not null);
create policy "owner delete delivery_slips" on delivery_slips for delete using (is_owner());

create policy "staff read delivery_slip_items" on delivery_slip_items for select using (auth.uid() is not null);
create policy "staff write delivery_slip_items" on delivery_slip_items for insert with check (auth.uid() is not null);
create policy "staff update delivery_slip_items" on delivery_slip_items for update using (auth.uid() is not null);
create policy "owner delete delivery_slip_items" on delivery_slip_items for delete using (is_owner());

create policy "staff read purchases" on purchases for select using (auth.uid() is not null);
create policy "staff write purchases" on purchases for insert with check (auth.uid() is not null);
create policy "staff update purchases" on purchases for update using (auth.uid() is not null);
create policy "owner delete purchases" on purchases for delete using (is_owner());

create policy "staff read purchase_items" on purchase_items for select using (auth.uid() is not null);
create policy "staff write purchase_items" on purchase_items for insert with check (auth.uid() is not null);
create policy "staff update purchase_items" on purchase_items for update using (auth.uid() is not null);
create policy "owner delete purchase_items" on purchase_items for delete using (is_owner());

create policy "staff read stock_movements" on stock_movements for select using (auth.uid() is not null);
create policy "staff write stock_movements" on stock_movements for insert with check (auth.uid() is not null);
