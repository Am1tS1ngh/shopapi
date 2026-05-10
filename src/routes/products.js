const router = require('express').Router();
const pool = require('../db/pool');

router.get('/', async (req, res) => {
    const {
        category, minPrice, maxPrice, search,
        sort = 'created_at',
        order = 'desc',
        page = 1,
        limit = 10,
    } = req.query;

    //Build WHERE clause dynamically
    const conditions = [];
    const params = [];

    // Sanitize sort/order with allowlists
    const allowedSort = ['price', 'name', 'created_at', 'stock'];
    const allowedOrder = ['asc', 'desc'];
    const sortCol = allowedSort.includes(sort) ? `p.${sort}` : 'p.created_at';
    const sortOrder = allowedOrder.includes(order) ? order : 'desc';



    if (category) {
        params.push(category);
        conditions.push(`c.slug = $${params.length}`);
    }

    if (minPrice) {
        params.push(parseFloat(minPrice));
        conditions.push(`p.price >= $${params.length}`);
    }

    if (maxPrice) {
        params.push(parseFloat(maxPrice));
        conditions.push(`p.price <= $${params.length}`);
    }

    if (search) {
        params.push(`%${search}%`);
        conditions.push(`p.name ILIKE $${params.length}`);
    }

    //Compute pagination params with defaults and limits
    const pageSize = Math.min(parseInt(limit), 50);
    const offset = (parseInt(page) - 1) * pageSize;
    params.push(pageSize, offset);

    const whereClause = conditions.length
        ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
        const productsQuery = `
            SELECT p.id, p.name, p.description, p.price, p.stock, p.created_at,
                    c.name AS category_name, c.slug AS category_slug
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
            ORDER BY ${sortCol} ${sortOrder}
            LIMIT $${params.length - 1} OFFSET $${params.length}
        `;

        const countQuery = `
            SELECT COUNT(*) AS total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
        `;

        const [productsResult, countResult] = await Promise.all([
            pool.query(productsQuery, params),
            pool.query(countQuery, params.slice(0, -2)),  // count doesn't use LIMIT/OFFSET params
        ]);

        const total = parseInt(countResult.rows[0].total);

        res.json({
            products: productsResult.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/stats/by-category', async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                c.name                          AS category,
                COUNT(p.id)                     AS product_count,
                MIN(p.price)                    AS min_price,
                MAX(p.price)                    AS max_price,
                ROUND(AVG(p.price)::numeric, 2) AS avg_price,
                SUM(p.stock)                    AS total_stock
            FROM categories c
            LEFT JOIN products p ON p.category_id = c.id
            GROUP BY c.id, c.name
            HAVING COUNT(p.id) > 0
            ORDER BY product_count DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Product not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;