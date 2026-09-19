    // db.js
    const { Pool } = require('pg');
    require('dotenv').config();
   const pool = new Pool({
      connectionString: process.env.SUPABASE_DATABASE_URL2,
      ssl: { rejectUnauthorized: false },
    });

   /* const pool = new Pool({
        host: "orgasedooysog.beget.app",
        port: 5432,
        user: "cloud_user",
        password: "w*sVwHf6Yn%*",
        database: "checkmate",
    });*/


    module.exports = pool;
