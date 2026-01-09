-- Fix users with correct password hash for 'password123'
-- This script will update existing users or create them if they don't exist

-- Generate a fresh hash for password123 (run: node -e "require('bcrypt').hash('password123', 10).then(h => console.log(h))")
-- Using a verified hash that works

-- Delete existing test users if they exist (optional - comment out if you want to keep data)
-- DELETE FROM users WHERE email IN ('alice@example.com', 'bob@example.com', 'charlie@example.com', 'diana@example.com');

-- Insert/Update users with correct password hash
-- Password: password123
INSERT INTO users (name, email, password_hash, role) VALUES
('Alice Sales', 'alice@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'sales'),
('Bob Sales', 'bob@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'sales'),
('Charlie Production', 'charlie@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'production'),
('Diana Director', 'diana@example.com', '$2b$10$zZp312mqbl4w4QvH0h7X5.bQuwWja1wkvNu8yOmdpStep7SDT2T/y', 'director')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
