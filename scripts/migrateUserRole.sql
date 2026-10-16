-- Manual SQL Script to migrate user role from ENUM to VARCHAR
-- Run this directly in your PostgreSQL database

-- Step 1: Drop the ENUM constraint (if it exists)
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- Step 2: Update existing 'customer' values to 'user'
UPDATE users 
SET role = 'user' 
WHERE role = 'customer';

-- Step 3: Convert the column type to VARCHAR
ALTER TABLE users 
ALTER COLUMN role TYPE VARCHAR(255);

-- Step 4: Set the default value
ALTER TABLE users 
ALTER COLUMN role SET DEFAULT 'user';

-- Step 5: Verify the changes
SELECT id, email, role FROM users LIMIT 5;
