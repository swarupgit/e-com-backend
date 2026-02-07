-- Add is_available column to order_items table
-- This allows tracking which items in an order are available/unavailable

USE ecommerce_db;

ALTER TABLE order_items 
ADD COLUMN is_available BOOLEAN DEFAULT TRUE AFTER subtotal;

-- Update existing records to TRUE (available by default)
UPDATE order_items SET is_available = TRUE WHERE is_available IS NULL;
