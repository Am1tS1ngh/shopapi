const router = require('express').Router();
const pool = require('../db/pool');
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
    const { items } = req.body;

    // items = [{ productId: 1, quantity: 2 }, ...]
    if (!items || !items.length)
        return res.status(400).json({ error: 'items array required' });

    // Get a dedicated connection for the whole transaction
    const client = await pool.connect();

    try {
        // await client.query(`SET lock_timeout = '5s'`);      // wait max 5s for lock
        // await client.query(`SET statement_timeout = '30s'`); // query max 30s to execute
        await client.query('BEGIN');     // <-- START transaction

        let totalAmount = 0;
        const orderLines = [];

        // Step 1: lock product rows + check stock (THE KEY CHANGE)
        const productIds = items.map(i => i.productId);
        const { rows: products } = await client.query(
            `SELECT id, name, price, stock
            FROM products
            WHERE id = ANY($1)
            FOR UPDATE`,         // <-- row-level lock
            [productIds]
        );

        const productMap = {};
        products.forEach(p => { productMap[p.id] = p; });
        for (const item of items) {
            const product = productMap[item.productId];
            if (!product)
                throw new Error(`Product ${item.productId} not found`);
            if (product.stock < item.quantity)
                throw new Error(
                    `Insufficient stock for \"${product.name}\". Available: ${product.stock}, requested: ${item.quantity}`
                );
            totalAmount += parseFloat(product.price) * item.quantity;
            orderLines.push({ product, quantity: item.quantity });
        }

        // Step 2: Create the order
        const { rows: orderRows } = await client.query(
            `INSERT INTO orders (user_id, total_amount, status)
            VALUES ($1, $2, 'confirmed') RETURNING *`,
            [req.user.id, totalAmount.toFixed(2)]
        );
        const order = orderRows[0];

        // Step 3: insert order_items + deduct stock
        for (const { product, quantity } of orderLines) {
            await client.query(
                `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase)
                VALUES ($1, $2, $3, $4)`,
                [order.id, product.id, quantity, product.price]
            );
            await client.query(
                'UPDATE products SET stock = stock - $1 WHERE id = $2',
                [quantity, product.id]
            );
        }
        await client.query('COMMIT');     // <-- make permanen

        res.status(201).json({
            message: 'Order placed successfully',
            order: {
                ...order,
                items: orderLines.map(({ product, quantity }) => ({
                    product: product.name,
                    quantity,
                    priceAtPurchase: product.price,
                    subtotal: (product.price * quantity).toFixed(2),
                })),
            },
        });
    } catch (err) {
        await client.query('ROLLBACK');   // <-- undo everything
        res.status(400).json({ error: err.message });
    } finally {
        client.release();                // <-- release connection back to pool
    }
});


router.get('/my', auth, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT
                o.id           AS order_id,
                o.status,
                o.total_amount,
                o.created_at,
                COUNT(oi.id)             AS item_count,
                STRING_AGG(p.name, ', ') AS products_ordered
            FROM orders o
            JOIN order_items oi ON oi.order_id   = o.id
            JOIN products p     ON oi.product_id = p.id
            WHERE o.user_id = $1
            GROUP BY o.id, o.status, o.total_amount, o.created_at
            ORDER BY o.created_at DESC`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin Orders report endpoint
router.get('/admin/report', auth, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });
    try {
        const { rows } = await pool.query(`
        SELECT
            DATE_TRUNC('day', o.created_at)        AS date,
            COUNT(DISTINCT o.id)                   AS order_count,
            COUNT(DISTINCT o.user_id)              AS unique_customers,
            SUM(o.total_amount)                    AS revenue,
            ROUND(AVG(o.total_amount)::numeric, 2) AS avg_order_value
        FROM orders o
        WHERE o.status != 'cancelled'
        GROUP BY DATE_TRUNC('day', o.created_at)
        ORDER BY date DESC
        LIMIT 30
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

//order details
router.get('/:id', auth, async (req, res) => {
    try {
        const { rows: orderRows } = await pool.query(
            `SELECT o.*, u.name AS customer_name, u.email AS customer_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = $1 AND (o.user_id = $2 OR $3 = 'admin')`,
            [req.params.id, req.user.id, req.user.role]
        );

        if (!orderRows.length)
            return res.status(404).json({ error: 'Order not found' });

        const { rows: itemRows } = await pool.query(
            `SELECT
                oi.quantity,
                oi.price_at_purchase,
                (oi.quantity * oi.price_at_purchase) AS subtotal,
                p.name  AS product_name,
                p.price AS current_price,
                c.name  AS category_name
            FROM order_items oi
            JOIN products p   ON oi.product_id = p.id
            JOIN categories c ON p.category_id = c.id
            WHERE oi.order_id = $1`,
            [req.params.id]
        );

        res.json({ order: orderRows[0], items: itemRows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Admin endpoint to update order status
router.patch('/:id/status', auth, async (req, res) => {
    if (req.user.role !== 'admin')
        return res.status(403).json({ error: 'Admin only' });

    const { status } = req.body;
    const valid = ['confirmed', 'shipped', 'delivered', 'cancelled'];

    if (!valid.includes(status))
        return res.status(400).json({ error: `Status must be one of: ${valid.join(', ')}` });

    try {
        const { rows } = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, req.params.id]
        );

        if (!rows.length) return res.status(404).json({ error: 'Order not found' });
        
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;