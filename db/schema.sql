-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('sales', 'production', 'director')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    baseline_floor_per_box NUMERIC DEFAULT 700,
    yearly_box_target INTEGER DEFAULT 900,
    rag_amber_floor_pct NUMERIC DEFAULT 0.90,
    monthly_box_targets_json JSONB,
    install_capacity_high_season_per_week INTEGER DEFAULT 15,
    fy_start_month INTEGER DEFAULT 7,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table (order-level input; source of truth)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_date DATE NOT NULL,
    order_ref TEXT,
    sales_rep_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    boxes_qty INTEGER NOT NULL CHECK (boxes_qty >= 1),
    box_rrp_total NUMERIC NOT NULL,
    box_net_total NUMERIC NOT NULL,
    box_build_cost_total NUMERIC NOT NULL,
    install_revenue NUMERIC DEFAULT 0,
    extras_revenue NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production boxes table
CREATE TABLE IF NOT EXISTS production_boxes (
    id SERIAL PRIMARY KEY,
    production_date DATE NOT NULL,
    boxes_built INTEGER NOT NULL,
    boxes_over_cost INTEGER DEFAULT 0,
    over_cost_reasons_json JSONB,
    rework_boxes INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard notes table
CREATE TABLE IF NOT EXISTS dashboard_notes (
    id SERIAL PRIMARY KEY,
    fy_label TEXT NOT NULL,
    fy_month TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('sales', 'production', 'director')),
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fy_label, fy_month, role)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_sales_rep_id ON orders(sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_orders_date_rep ON orders(order_date, sales_rep_id);
CREATE INDEX IF NOT EXISTS idx_production_boxes_date ON production_boxes(production_date);
CREATE INDEX IF NOT EXISTS idx_dashboard_notes_lookup ON dashboard_notes(fy_label, fy_month, role);
