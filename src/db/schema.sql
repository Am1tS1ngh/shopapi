DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders   CASCADE;
DROP TABLE IF EXISTS products   CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;


CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL, CHECK (price > 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);


CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total_amount DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0 ),
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    UNIQUE(order_id, product_id)
);


CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status On orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);


INSERT INTO categories (name, slug) VALUES
('Electronics', 'electronics'),
('Footwear',    'footwear'),
('Books', 'books'),
('Home & Kitchen', 'home-kitchen');

INSERT INTO products (name, description, price, stock, category_id) VALUES
    ('iPhone 15',        '6.1 inch display, A16 chip',     79999.00,  10, 1),
  ('Samsung Galaxy',   '6.4 inch AMOLED display',         49999.00, 15, 1),
  ('Bluetooth Speaker','360 degree sound, 24hr battery',   2999.00, 50, 1),
  ('Nike Air Max',     'Running shoes, cushioned sole',    7999.00, 30, 2),
  ('Adidas Ultraboost','Premium running shoes',            9999.00, 20, 2),
  ('Clean Code',       'Robert Martin, software craft',     699.00,100, 3),
  ('System Design',    'Alex Xu, system design guide',      799.00, 80, 3);


-- Password is 'password123' bcrypt-hashed
INSERT INTO users (name, email, password, role) VALUES
  ('Admin User', 'admin@shop.com', '$2b$10$Esq3BhMV7Lfv3zBBsEr0Su/HzvPywqPBuqdSYwR03401UbRdm/9Ee', 'admin'),
  ('Rahul Sharma','rahul@gmail.com', '$2b$10$Esq3BhMV7Lfv3zBBsEr0Su/HzvPywqPBuqdSYwR03401UbRdm/9Ee', 'customer'),
  ('Priya Singh', 'priya@gmail.com', '$2b$10$Esq3BhMV7Lfv3zBBsEr0Su/HzvPywqPBuqdSYwR03401UbRdm/9Ee', 'customer');