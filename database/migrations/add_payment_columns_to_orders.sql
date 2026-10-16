-- Add payment details columns to orders table

ALTER TABLE orders ADD COLUMN bank_name VARCHAR(255) DEFAULT NULL;
