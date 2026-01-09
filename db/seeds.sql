-- Seed users (password is 'password123' for all users)
-- NOTE: These are example users. In production, change passwords immediately.
-- The password hash below is for 'password123' - verified working hash
INSERT INTO users (name, email, password_hash, role) VALUES
('Alice Sales', 'alice@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'sales'),
('Bob Sales', 'bob@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'sales'),
('Charlie Production', 'charlie@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'production'),
('Diana Director', 'diana@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'director')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- Seed settings (single row)
-- Monthly targets distributed across Jul-Jun (900 total)
INSERT INTO settings (
    baseline_floor_per_box,
    yearly_box_target,
    rag_amber_floor_pct,
    monthly_box_targets_json,
    install_capacity_high_season_per_week,
    fy_start_month
) VALUES (
    700,
    900,
    0.90,
    '{"Jul": 60, "Aug": 70, "Sep": 80, "Oct": 90, "Nov": 85, "Dec": 75, "Jan": 70, "Feb": 75, "Mar": 85, "Apr": 90, "May": 80, "Jun": 60}',
    15,
    7
)
ON CONFLICT DO NOTHING;

-- Seed example orders (spread across current FY)
-- Get current date and calculate FY dates
-- For seeding, we'll use dates from July 2024 to current
DO $$
DECLARE
    sales_rep_1_id INTEGER;
    sales_rep_2_id INTEGER;
    current_date DATE := CURRENT_DATE;
    fy_start DATE;
    order_date DATE;
BEGIN
    -- Get sales rep IDs
    SELECT id INTO sales_rep_1_id FROM users WHERE email = 'alice@example.com' LIMIT 1;
    SELECT id INTO sales_rep_2_id FROM users WHERE email = 'bob@example.com' LIMIT 1;
    
    -- Calculate FY start (July 1 of current or previous year)
    IF EXTRACT(MONTH FROM current_date) >= 7 THEN
        fy_start := DATE(EXTRACT(YEAR FROM current_date) || '-07-01');
    ELSE
        fy_start := DATE((EXTRACT(YEAR FROM current_date) - 1) || '-07-01');
    END IF;
    
    -- Insert sample orders
    INSERT INTO orders (order_date, order_ref, sales_rep_id, boxes_qty, box_rrp_total, box_net_total, box_build_cost_total, install_revenue, extras_revenue, notes) VALUES
    (fy_start + INTERVAL '5 days', 'ORD-001', sales_rep_1_id, 2, 2800, 2600, 1400, 500, 200, 'Initial order'),
    (fy_start + INTERVAL '12 days', 'ORD-002', sales_rep_1_id, 3, 4200, 4000, 2100, 600, 0, 'Follow-up order'),
    (fy_start + INTERVAL '18 days', 'ORD-003', sales_rep_2_id, 1, 1400, 1400, 700, 300, 100, 'Single box order'),
    (fy_start + INTERVAL '25 days', 'ORD-004', sales_rep_1_id, 4, 5600, 5200, 2800, 800, 400, 'Large order'),
    (fy_start + INTERVAL '35 days', 'ORD-005', sales_rep_2_id, 2, 2800, 2700, 1400, 400, 150, 'Standard order'),
    (fy_start + INTERVAL '45 days', 'ORD-006', sales_rep_1_id, 3, 4200, 3900, 2100, 700, 300, 'Discounted order'),
    (fy_start + INTERVAL '55 days', 'ORD-007', sales_rep_2_id, 1, 1400, 1350, 700, 250, 0, 'Small order'),
    (fy_start + INTERVAL '65 days', 'ORD-008', sales_rep_1_id, 5, 7000, 6500, 3500, 1000, 500, 'Large discounted order'),
    (fy_start + INTERVAL '75 days', 'ORD-009', sales_rep_2_id, 2, 2800, 2800, 1400, 500, 200, 'Full price order'),
    (fy_start + INTERVAL '85 days', 'ORD-010', sales_rep_1_id, 3, 4200, 4100, 2100, 600, 250, 'Recent order'),
    (fy_start + INTERVAL '95 days', 'ORD-011', sales_rep_2_id, 2, 2800, 2750, 1400, 450, 100, 'Standard order'),
    (fy_start + INTERVAL '105 days', 'ORD-012', sales_rep_1_id, 4, 5600, 5400, 2800, 900, 350, 'Large order with extras'),
    (fy_start + INTERVAL '115 days', 'ORD-013', sales_rep_2_id, 1, 1400, 1400, 700, 300, 0, 'Single box'),
    (fy_start + INTERVAL '125 days', 'ORD-014', sales_rep_1_id, 3, 4200, 4000, 2100, 650, 200, 'Recent order'),
    (fy_start + INTERVAL '135 days', 'ORD-015', sales_rep_2_id, 2, 2800, 2650, 1400, 500, 150, 'Discounted order')
    ON CONFLICT DO NOTHING;
END $$;

-- Seed production entries
DO $$
DECLARE
    current_date DATE := CURRENT_DATE;
    fy_start DATE;
    prod_date DATE;
BEGIN
    -- Calculate FY start
    IF EXTRACT(MONTH FROM current_date) >= 7 THEN
        fy_start := DATE(EXTRACT(YEAR FROM current_date) || '-07-01');
    ELSE
        fy_start := DATE((EXTRACT(YEAR FROM current_date) - 1) || '-07-01');
    END IF;
    
    -- Insert production entries
    INSERT INTO production_boxes (production_date, boxes_built, boxes_over_cost, over_cost_reasons_json, rework_boxes, notes) VALUES
    (fy_start + INTERVAL '7 days', 2, 0, '[]', 0, 'On target production'),
    (fy_start + INTERVAL '14 days', 3, 1, '[{"reason": "material", "boxes": 1}]', 0, 'Material cost issue'),
    (fy_start + INTERVAL '21 days', 4, 0, '[]', 1, 'One rework box'),
    (fy_start + INTERVAL '28 days', 5, 1, '[{"reason": "rework", "boxes": 1}]', 0, 'Rework cost'),
    (fy_start + INTERVAL '42 days', 3, 0, '[]', 0, 'Standard production'),
    (fy_start + INTERVAL '56 days', 4, 2, '[{"reason": "install", "boxes": 1}, {"reason": "material", "boxes": 1}]', 1, 'Multiple issues'),
    (fy_start + INTERVAL '70 days', 6, 0, '[]', 0, 'Good production run'),
    (fy_start + INTERVAL '84 days', 5, 1, '[{"reason": "rework", "boxes": 1}]', 2, 'Rework issues')
    ON CONFLICT DO NOTHING;
END $$;

-- Seed dashboard notes
DO $$
DECLARE
    current_date DATE := CURRENT_DATE;
    fy_label TEXT;
    fy_month TEXT;
    month_num INTEGER;
BEGIN
    -- Calculate FY label
    IF EXTRACT(MONTH FROM current_date) >= 7 THEN
        fy_label := EXTRACT(YEAR FROM current_date) || '/' || SUBSTRING((EXTRACT(YEAR FROM current_date) + 1)::TEXT, 3, 2);
    ELSE
        fy_label := (EXTRACT(YEAR FROM current_date) - 1) || '/' || SUBSTRING(EXTRACT(YEAR FROM current_date)::TEXT, 3, 2);
    END IF;
    
    -- Get current month name
    month_num := EXTRACT(MONTH FROM current_date);
    IF month_num >= 7 THEN
        CASE month_num
            WHEN 7 THEN fy_month := 'Jul';
            WHEN 8 THEN fy_month := 'Aug';
            WHEN 9 THEN fy_month := 'Sep';
            WHEN 10 THEN fy_month := 'Oct';
            WHEN 11 THEN fy_month := 'Nov';
            WHEN 12 THEN fy_month := 'Dec';
        END CASE;
    ELSE
        CASE month_num
            WHEN 1 THEN fy_month := 'Jan';
            WHEN 2 THEN fy_month := 'Feb';
            WHEN 3 THEN fy_month := 'Mar';
            WHEN 4 THEN fy_month := 'Apr';
            WHEN 5 THEN fy_month := 'May';
            WHEN 6 THEN fy_month := 'Jun';
        END CASE;
    END IF;
    
    -- Insert sample notes
    INSERT INTO dashboard_notes (fy_label, fy_month, role, note) VALUES
    (fy_label, fy_month, 'sales', 'Strong start to the month. Focus on maintaining margin.'),
    (fy_label, fy_month, 'production', 'Production on track. Monitoring cost compliance.'),
    (fy_label, fy_month, 'director', 'Overall performance meeting targets. Watch discount levels.')
    ON CONFLICT DO NOTHING;
END $$;
