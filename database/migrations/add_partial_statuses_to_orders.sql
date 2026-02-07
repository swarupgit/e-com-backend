-- Add partial_accepted and partial_processing to orders status enum

USE ecommerce_db;

ALTER TABLE orders 
MODIFY COLUMN status ENUM(
    'pending', 
    'accepted', 
    'partial_accepted',
    'rejected', 
    'processing', 
    'partial_processing',
    'out_for_delivery', 
    'delivered', 
    'cancelled'
) DEFAULT 'pending';
