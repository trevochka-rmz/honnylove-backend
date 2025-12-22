const db = require('../config/db');

const getUserById = async (id) => {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0];
};

const getUserByEmail = async (email) => {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [
        email,
    ]);
    return rows[0];
};

const createUser = async (data) => {
    const {
        username,
        email,
        password_hash,
        role,
        first_name,
        last_name,
        phone,
        address,
    } = data;
    const { rows } = await db.query(
        `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
            username,
            email,
            password_hash,
            role,
            first_name,
            last_name,
            phone,
            address,
        ]
    );
    return rows[0];
};

const updateUser = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );
    return rows[0];
};

const updateRefreshToken = async (id, token) => {
    // Предполагаем, что добавили поле refresh_token в users
    return updateUser(id, { refresh_token: token });
};

const getAllUsers = async ({ page = 1, limit = 10, role }) => {
    let query = 'SELECT * FROM users';
    const params = [];
    if (role) {
        query += ' WHERE role = $1';
        params.push(role);
    }
    query += ` ORDER BY id LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(query, params);
    return rows;
};

module.exports = {
    getUserById,
    getUserByEmail,
    createUser,
    updateUser,
    updateRefreshToken,
    getAllUsers,
};
