-- E-Commerce Database Schema
-- Drop existing database if exists and create new
DROP DATABASE IF EXISTS ecommerce_db;
CREATE DATABASE ecommerce_db;
USE ecommerce_db;

-- Users Table (Super Admin, Merchant Admin, Regular Users)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('super_admin', 'merchant', 'user') NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Item Categories Table
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
);

-- Items Master Table (Master list of products)
CREATE TABLE items_master (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2),
    unit VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    INDEX idx_category (category_id),
    INDEX idx_name (name)
);

-- Merchant Details Table
CREATE TABLE merchants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    business_address TEXT,
    category_id INT,
    subscription_status ENUM('active', 'inactive', 'expired') DEFAULT 'inactive',
    subscription_start_date DATE,
    subscription_end_date DATE,
    subscription_amount DECIMAL(10, 2) DEFAULT 3000.00,
    payment_method ENUM('offline', 'online') DEFAULT 'offline',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_user (user_id),
    INDEX idx_subscription (subscription_status)
);

-- Merchant Products Table
CREATE TABLE merchant_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    merchant_id INT NOT NULL,
    item_master_id INT NOT NULL,
    custom_name VARCHAR(255),
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    status ENUM('available', 'out_of_stock', 'not_available') DEFAULT 'available',
    image_url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    FOREIGN KEY (item_master_id) REFERENCES items_master(id) ON DELETE CASCADE,
    INDEX idx_merchant (merchant_id),
    INDEX idx_status (status),
    INDEX idx_item (item_master_id)
);

-- Customer Addresses Table
CREATE TABLE customer_addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
);

-- Orders Table
CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INT,
    merchant_id INT NOT NULL,
    guest_name VARCHAR(255),
    guest_email VARCHAR(255),
    guest_phone VARCHAR(20),
    delivery_address TEXT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'accepted', 'rejected', 'processing', 'out_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending',
    payment_method ENUM('cod', 'online') DEFAULT 'cod',
    payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    INDEX idx_order_number (order_number),
    INDEX idx_user (user_id),
    INDEX idx_merchant (merchant_id),
    INDEX idx_status (status),
    INDEX idx_created (created_at)
);

-- Order Items Table
CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    merchant_product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_product_id) REFERENCES merchant_products(id) ON DELETE CASCADE,
    INDEX idx_order (order_id)
);

-- Subscription Payments Table
CREATE TABLE subscription_payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    merchant_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('offline', 'online') DEFAULT 'offline',
    payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    transaction_id VARCHAR(255),
    payment_date DATE,
    subscription_start_date DATE NOT NULL,
    subscription_end_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE,
    INDEX idx_merchant (merchant_id),
    INDEX idx_status (payment_status)
);

-- Cart Table (for registered users)
CREATE TABLE cart (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    merchant_product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_product_id) REFERENCES merchant_products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_product (user_id, merchant_product_id),
    INDEX idx_user (user_id)
);

-- Insert Default Super Admin
-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (email, password, name, role) VALUES 
('admin@ecommerce.com', '$2a$10$rnFmS/oT5kqpUenocXpJA.lFvHeUGNrNWPzAZQXyEgGrCFDsGFDb2', 'Super Admin', 'super_admin');

-- Insert Sample Categories
INSERT INTO categories (name, description) VALUES 
('Groceries', 'Food and grocery items'),
('Vegetables', 'Fresh vegetables'),
('Fruits', 'Fresh fruits'),
('Dairy Products', 'Milk, cheese, butter, etc.'),
('Bakery', 'Bread, cakes, pastries');

-- Insert Sample Items Master
INSERT INTO items_master (category_id, name, description, base_price, unit) VALUES
(1, 'Rice', 'White rice', 50.00, 'kg'),
(1, 'Wheat Flour', 'All purpose flour', 40.00, 'kg'),
(2, 'Tomato', 'Fresh tomatoes', 30.00, 'kg'),
(2, 'Onion', 'Fresh onions', 25.00, 'kg'),
(2, 'Potato', 'Fresh potatoes', 20.00, 'kg'),
(3, 'Apple', 'Fresh apples', 120.00, 'kg'),
(3, 'Banana', 'Fresh bananas', 40.00, 'dozen'),
(4, 'Milk', 'Fresh milk', 50.00, 'liter'),
(4, 'Butter', 'Fresh butter', 450.00, 'kg'),
(5, 'Bread', 'White bread', 35.00, 'piece');
