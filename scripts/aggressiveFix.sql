-- AGGRESSIVE FIX for user role column
-- Run this if the migration script fails

-- Step 1: Drop the table and recreate it (WARNING: This will delete all user data)
-- ONLY USE THIS AS A LAST RESORT IF YOU HAVE NO IMPORTANT USER DATA

-- First, backup your data if needed:
-- CREATE TABLE users_backup AS TABLE users;

-- Drop and recreate the table
DROP TABLE IF EXISTS users CASCADE;

-- Recreate the table with the correct structure
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(255),
    role VARCHAR(255) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- If you have a backup, restore it:
-- INSERT INTO users (id, first_name, last_name, email, password, phone, role, is_active, created_at, updated_at)
-- SELECT id, first_name, last_name, email, password, phone, 
--        CASE WHEN role = 'customer' THEN 'user' ELSE role END,
--        is_active, created_at, updated_at 
-- FROM users_backup;

-- Verify the table structure
\d users;
