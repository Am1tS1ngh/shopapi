const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// POST /api/users/register
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
        return res.status(400).json({ error: 'Name, email and password are required' });

    try {
        const hashed = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
            [name, email, hashed]
        );
        const user = rows[0];
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        res.status(201).json({ user, token });
    } catch (err) {
        if (err.code === '23505')   // PostgreSQL unique violation
            return res.status(409).json({ error: 'Email already registered' });
        res.status(500).json({ error: err.message });
    }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required' });

    try {
        const { rows } = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        if (!rows.length)
            return res.status(401).json({ error: 'Invalid credentials' });
        
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        
        if (!match)
            return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        delete user.password;     // don't send hash to client
        res.json({ user, token });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;