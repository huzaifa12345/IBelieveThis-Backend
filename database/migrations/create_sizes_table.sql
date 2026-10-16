-- Create sizes table
CREATE TABLE IF NOT EXISTS sizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    size VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default sizes
INSERT INTO sizes (size, description) VALUES
('9-12 months', 'Suitable for kids aged 9-12 months (6-9 kg)'),
('12-18 months', 'Suitable for kids aged 12-18 months (9-11 kg)'),
('18-24 months', 'Suitable for kids aged 18-24 months (11-12 kg)'),
('2-3 years', 'Suitable for kids aged 2-3 years (12-14 kg)'),
('3-4 years', 'Suitable for kids aged 3-4 years (14-16 kg)'),
('4-5 years', 'Suitable for kids aged 4-5 years (16-18 kg)'),
('5-6 years', 'Suitable for kids aged 5-6 years (18-20 kg)'),
('6-7 years', 'Suitable for kids aged 6-7 years (20-22 kg)'),
('7-8 years', 'Suitable for kids aged 7-8 years (22-25 kg)'),
('9-10 years', 'Suitable for kids aged 9-10 years (25-28 kg)');

-- Add size column to order_items table if it doesn't exist
ALTER TABLE order_items ADD COLUMN selected_size VARCHAR(50) DEFAULT NULL;
