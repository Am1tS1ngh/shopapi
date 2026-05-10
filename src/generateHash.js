const bcrypt = require('bcryptjs');

async function main() {
    const hash = await bcrypt.hash('password123', 10);
    console.log(hash);
}

main();