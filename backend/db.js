import pkg from 'pg'

const { Pool } = pkg

const pool = new Pool({
  user: 'stockuser',
  host: 'localhost',
  database: 'stockvision',
  password: 'stock123',
  port: 5432
})

pool.connect()
  .then(() => console.log('✅ Conexión a PostgreSQL OK'))
  .catch(err => console.error('❌ Error PostgreSQL:', err))

export default pool
