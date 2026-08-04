import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pool from './db.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/api', (req, res) => {
    res.json({
        ok: true,
        message: 'StockVision API funcionando con PostgreSQL'
    })
})

app.get('/api/stocks', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT symbol, empresa, sector, precio_actual FROM stocks ORDER BY symbol'
        )

        const acciones = resultado.rows.map(a => ({
            symbol: a.symbol,
            name: a.empresa,
            sector: a.sector,
            price: Number(a.precio_actual),
            change: 0
        }))

        res.json(acciones)

    } catch (error) {
        console.error('ERROR PG:', error)
        res.status(500).json({
            ok: false,
            message: 'Error consultando PostgreSQL'
        })
    }
})

app.get('/api/stocks/:symbol', async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').trim().toUpperCase()

    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) {
      return res.status(400).json({
        ok: false,
        message: 'Símbolo inválido'
      })
    }

    const headers = {}

    if (process.env.MARKETDATA_TOKEN) {
      headers.Authorization = `Bearer ${process.env.MARKETDATA_TOKEN}`
    }

    const respuesta = await fetch(
      `https://api.marketdata.app/v1/stocks/quotes/${encodeURIComponent(symbol)}/`,
      { headers }
    )

    const datos = await respuesta.json()

    if (![200, 203].includes(respuesta.status) || datos.s !== 'ok') {
      return res.status(respuesta.status === 401 ? 401 : 404).json({
        ok: false,
        message: datos.errmsg || 'No fue posible obtener la cotización'
      })
    }

    const precio = Number(datos.last?.[0])
    const cambio = Number(datos.change?.[0] ?? 0)
    const porcentaje = Number(datos.changepct?.[0] ?? 0) * 100

    if (!Number.isFinite(precio)) {
      return res.status(502).json({
        ok: false,
        message: 'MarketData no devolvió un precio válido'
      })
    }

    const resultado = await pool.query(
      `INSERT INTO stocks (symbol, empresa, sector, precio_actual)
       VALUES ($1, $1, 'MarketData', $2)
       ON CONFLICT (symbol)
       DO UPDATE SET precio_actual = EXCLUDED.precio_actual
       RETURNING symbol, empresa, sector, precio_actual`,
      [symbol, precio]
    )

    const accion = resultado.rows[0]

    res.json({
      symbol: accion.symbol,
      name: accion.empresa,
      sector: accion.sector,
      price: Number(accion.precio_actual),
      change: cambio,
      changePercent: porcentaje,
      source: 'MarketData.app'
    })
  } catch (error) {
    console.error('Error consultando MarketData:', error)

    res.status(500).json({
      ok: false,
      message: 'Error consultando la API externa'
    })
  }
})


app.get('/api/portfolios', async (_req, res) => {
  try {
    const resultado = await pool.query(
      `WITH operaciones AS (
         SELECT
           portfolio_id,

           COALESCE(
             SUM(CASE
               WHEN tipo = 'BUY' THEN cantidad * precio
               ELSE 0
             END),
             0
           ) AS total_compras,

           COALESCE(
             SUM(CASE
               WHEN tipo = 'SELL' THEN cantidad * precio
               ELSE 0
             END),
             0
           ) AS total_ventas,

           COUNT(*) FILTER (WHERE tipo = 'BUY') AS cantidad_compras,
           COUNT(*) FILTER (WHERE tipo = 'SELL') AS cantidad_ventas,

           COALESCE(
             SUM(CASE
               WHEN tipo = 'BUY' THEN cantidad * precio
               ELSE 0
             END)
             /
             NULLIF(
               SUM(CASE
                 WHEN tipo = 'BUY' THEN cantidad
                 ELSE 0
               END),
               0
             ),
             0
           ) AS precio_promedio_compra,

           COALESCE(
             SUM(CASE
               WHEN tipo = 'SELL' THEN cantidad * precio
               ELSE 0
             END)
             /
             NULLIF(
               SUM(CASE
                 WHEN tipo = 'SELL' THEN cantidad
                 ELSE 0
               END),
               0
             ),
             0
           ) AS precio_promedio_venta

         FROM transactions
         GROUP BY portfolio_id
       ),

       resumen_acciones AS (
         SELECT
           t.portfolio_id,
           t.stock_id,

           SUM(CASE
             WHEN t.tipo = 'BUY' THEN t.cantidad
             ELSE 0
           END) AS cantidad_comprada,

           SUM(CASE
             WHEN t.tipo = 'BUY' THEN t.cantidad * t.precio
             ELSE 0
           END) AS costo_compras,

           SUM(CASE
             WHEN t.tipo = 'SELL' THEN t.cantidad
             ELSE 0
           END) AS cantidad_vendida,

           SUM(CASE
             WHEN t.tipo = 'SELL' THEN t.cantidad * t.precio
             ELSE 0
           END) AS ingreso_ventas,

           MAX(s.precio_actual) AS precio_actual

         FROM transactions t
         JOIN stocks s ON s.id = t.stock_id
         GROUP BY t.portfolio_id, t.stock_id
       ),

       rendimiento AS (
         SELECT
           portfolio_id,

           SUM(
             ingreso_ventas
             -
             (
               cantidad_vendida
               *
               COALESCE(
                 costo_compras / NULLIF(cantidad_comprada, 0),
                 0
               )
             )
             +
             (
               (cantidad_comprada - cantidad_vendida)
               *
               (
                 precio_actual
                 -
                 COALESCE(
                   costo_compras / NULLIF(cantidad_comprada, 0),
                   0
                 )
               )
             )
           ) AS ganancia_perdida

         FROM resumen_acciones
         GROUP BY portfolio_id
       )

       SELECT
         p.id,
         p.nombre,
         p.presupuesto,
         p.saldo,
         p.created_at,

         COALESCE(o.total_compras, 0) AS total_compras,
         COALESCE(o.total_ventas, 0) AS total_ventas,
         COALESCE(o.cantidad_compras, 0) AS cantidad_compras,
         COALESCE(o.cantidad_ventas, 0) AS cantidad_ventas,
         COALESCE(o.precio_promedio_compra, 0) AS precio_promedio_compra,
         COALESCE(o.precio_promedio_venta, 0) AS precio_promedio_venta,
         COALESCE(r.ganancia_perdida, 0) AS ganancia_perdida

       FROM portfolios p
       LEFT JOIN operaciones o ON o.portfolio_id = p.id
       LEFT JOIN rendimiento r ON r.portfolio_id = p.id
       ORDER BY p.id`
    )

    res.json(
      resultado.rows.map(portafolio => ({
        id: portafolio.id,
        nombre: portafolio.nombre,
        presupuesto: Number(portafolio.presupuesto),
        saldo: Number(portafolio.saldo),
        created_at: portafolio.created_at,

        totalCompras: Number(portafolio.total_compras),
        totalVentas: Number(portafolio.total_ventas),

        cantidadCompras: Number(portafolio.cantidad_compras),
        cantidadVentas: Number(portafolio.cantidad_ventas),

        precioPromedioCompra: Number(portafolio.precio_promedio_compra),
        precioPromedioVenta: Number(portafolio.precio_promedio_venta),

        gananciaPerdida: Number(portafolio.ganancia_perdida)
      }))
    )
  } catch (error) {
    console.error('Error obteniendo portafolios:', error)

    res.status(500).json({
      ok: false,
      message: 'No fue posible obtener los portafolios'
    })
  }
})


app.post('/api/portfolios', async (req, res) => {
  try {
    const { nombre, presupuesto } = req.body
    const cantidad = Number(presupuesto)

    if (!nombre?.trim() || !cantidad || cantidad <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre y el presupuesto son obligatorios'
      })
    }

    const resultado = await pool.query(
      `INSERT INTO portfolios (nombre, presupuesto, saldo)
       VALUES ($1, $2, $2)
       RETURNING id, nombre, presupuesto, saldo, created_at`,
      [nombre.trim(), cantidad]
    )

    const portafolio = resultado.rows[0]

    res.status(201).json({
      ...portafolio,
      presupuesto: Number(portafolio.presupuesto),
      saldo: Number(portafolio.saldo)
    })
  } catch (error) {
    console.error('Error creando portafolio:', error)
    res.status(500).json({
      ok: false,
      message: 'No fue posible crear el portafolio'
    })
  }
})


app.post('/api/buy', async (req, res) => {
  const client = await pool.connect()

  try {
    const { portfolioId, symbol, cantidad, precio } = req.body
    const qty = Number(cantidad)
    const price = Number(precio)

    if (!portfolioId || !symbol || qty <= 0 || price <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'Datos de compra inválidos'
      })
    }

    await client.query('BEGIN')

    const portfolioResult = await client.query(
      'SELECT id, saldo FROM portfolios WHERE id = $1 FOR UPDATE',
      [portfolioId]
    )

    if (portfolioResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        ok: false,
        message: 'Portafolio no encontrado'
      })
    }

    const stockResult = await client.query(
      'SELECT id, symbol FROM stocks WHERE symbol = $1',
      [symbol.toUpperCase()]
    )

    if (stockResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        ok: false,
        message: 'Acción no encontrada'
      })
    }

    const total = qty * price
    const saldo = Number(portfolioResult.rows[0].saldo)

    if (total > saldo) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        ok: false,
        message: 'Saldo insuficiente'
      })
    }

    await client.query(
      `INSERT INTO transactions
       (portfolio_id, stock_id, tipo, cantidad, precio)
       VALUES ($1, $2, 'BUY', $3, $4)`,
      [portfolioId, stockResult.rows[0].id, qty, price]
    )

    const updatedPortfolio = await client.query(
      `UPDATE portfolios
       SET saldo = saldo - $1
       WHERE id = $2
       RETURNING id, nombre, presupuesto, saldo`,
      [total, portfolioId]
    )

    await client.query('COMMIT')

    res.status(201).json({
      ok: true,
      message: 'Compra registrada',
      portfolio: {
        ...updatedPortfolio.rows[0],
        presupuesto: Number(updatedPortfolio.rows[0].presupuesto),
        saldo: Number(updatedPortfolio.rows[0].saldo)
      },
      total
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error registrando compra:', error)
    res.status(500).json({
      ok: false,
      message: 'No fue posible registrar la compra'
    })
  } finally {
    client.release()
  }
})


app.get('/api/portfolios/:id/positions', async (req, res) => {
  try {
    const portfolioId = Number(req.params.id)

    const resultado = await pool.query(
      `SELECT
         s.symbol,
         s.empresa AS name,
         s.precio_actual,
         SUM(
           CASE
             WHEN t.tipo = 'BUY' THEN t.cantidad
             WHEN t.tipo = 'SELL' THEN -t.cantidad
             ELSE 0
           END
         ) AS cantidad,
         CASE
           WHEN SUM(CASE WHEN t.tipo = 'BUY' THEN t.cantidad ELSE 0 END) > 0
           THEN
             SUM(CASE WHEN t.tipo = 'BUY' THEN t.cantidad * t.precio ELSE 0 END)
             / SUM(CASE WHEN t.tipo = 'BUY' THEN t.cantidad ELSE 0 END)
           ELSE 0
         END AS precio_compra
       FROM transactions t
       JOIN stocks s ON s.id = t.stock_id
       WHERE t.portfolio_id = $1
       GROUP BY s.id, s.symbol, s.empresa, s.precio_actual
       HAVING SUM(
         CASE
           WHEN t.tipo = 'BUY' THEN t.cantidad
           WHEN t.tipo = 'SELL' THEN -t.cantidad
           ELSE 0
         END
       ) > 0
       ORDER BY s.symbol`,
      [portfolioId]
    )

    res.json(
      resultado.rows.map(item => ({
        symbol: item.symbol,
        name: item.name,
        cantidad: Number(item.cantidad),
        precioCompra: Number(item.precio_compra),
        precioActual: Number(item.precio_actual)
      }))
    )
  } catch (error) {
    console.error('Error obteniendo posiciones:', error)
    res.status(500).json({
      ok: false,
      message: 'No fue posible obtener las posiciones'
    })
  }
})



app.get('/api/portfolios/:id/history', async (req, res) => {
  try {
    const portfolioId = Number(req.params.id)

    if (!Number.isInteger(portfolioId) || portfolioId <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'Portafolio inválido'
      })
    }

    const resultado = await pool.query(
      `SELECT
         t.id,
         CASE
           WHEN t.tipo = 'BUY' THEN 'COMPRA'
           WHEN t.tipo = 'SELL' THEN 'VENTA'
           ELSE t.tipo
         END AS tipo,
         s.symbol,
         s.empresa AS name,
         t.cantidad,
         t.precio,
         t.cantidad * t.precio AS total,
         t.fecha,
         CASE
           WHEN t.tipo = 'SELL' THEN
             (
               t.precio -
               COALESCE(
                 (
                   SELECT
                     SUM(tb.cantidad * tb.precio)
                     / NULLIF(SUM(tb.cantidad), 0)
                   FROM transactions tb
                   WHERE tb.portfolio_id = t.portfolio_id
                     AND tb.stock_id = t.stock_id
                     AND tb.tipo = 'BUY'
                     AND tb.fecha <= t.fecha
                 ),
                 0
               )
             ) * t.cantidad
           ELSE 0
         END AS ganancia
       FROM transactions t
       JOIN stocks s ON s.id = t.stock_id
       WHERE t.portfolio_id = $1
       ORDER BY t.fecha DESC, t.id DESC`,
      [portfolioId]
    )

    res.json(
      resultado.rows.map(item => ({
        id: item.id,
        tipo: item.tipo,
        symbol: item.symbol,
        name: item.name,
        cantidad: Number(item.cantidad),
        precio: Number(item.precio),
        total: Number(item.total),
        ganancia: Number(item.ganancia),
        fecha: item.fecha
      }))
    )
  } catch (error) {
    console.error('Error obteniendo historial:', error)

    res.status(500).json({
      ok: false,
      message: 'No fue posible obtener el historial'
    })
  }
})

app.post('/api/sell', async (req, res) => {
  const client = await pool.connect()

  try {
    const { portfolioId, symbol, cantidad, precio } = req.body
    const qty = Number(cantidad)
    const price = Number(precio)
    const stockSymbol = String(symbol || '').toUpperCase()

    if (!portfolioId || !stockSymbol || qty <= 0 || price <= 0) {
      return res.status(400).json({
        ok: false,
        message: 'Datos de venta inválidos'
      })
    }

    await client.query('BEGIN')

    const portfolioResult = await client.query(
      `SELECT id, nombre, presupuesto, saldo
       FROM portfolios
       WHERE id = $1
       FOR UPDATE`,
      [portfolioId]
    )

    if (portfolioResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        ok: false,
        message: 'Portafolio no encontrado'
      })
    }

    const stockResult = await client.query(
      `SELECT id, symbol
       FROM stocks
       WHERE symbol = $1`,
      [stockSymbol]
    )

    if (stockResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        ok: false,
        message: 'Acción no encontrada'
      })
    }

    const stockId = stockResult.rows[0].id

    const positionResult = await client.query(
      `SELECT
         COALESCE(SUM(
           CASE
             WHEN tipo = 'BUY' THEN cantidad
             WHEN tipo = 'SELL' THEN -cantidad
             ELSE 0
           END
         ), 0) AS disponibles,
         COALESCE(
           SUM(CASE WHEN tipo = 'BUY' THEN cantidad * precio ELSE 0 END)
           / NULLIF(SUM(CASE WHEN tipo = 'BUY' THEN cantidad ELSE 0 END), 0),
           0
         ) AS precio_promedio
       FROM transactions
       WHERE portfolio_id = $1
         AND stock_id = $2`,
      [portfolioId, stockId]
    )

    const disponibles = Number(positionResult.rows[0].disponibles)
    const precioPromedio = Number(positionResult.rows[0].precio_promedio)

    if (qty > disponibles) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        ok: false,
        message: `Solo tienes ${disponibles} acciones disponibles`
      })
    }

    const totalVenta = qty * price
    const ganancia = (price - precioPromedio) * qty

    await client.query(
      `INSERT INTO transactions
       (portfolio_id, stock_id, tipo, cantidad, precio)
       VALUES ($1, $2, 'SELL', $3, $4)`,
      [portfolioId, stockId, qty, price]
    )

    const updatedPortfolio = await client.query(
      `UPDATE portfolios
       SET saldo = saldo + $1
       WHERE id = $2
       RETURNING id, nombre, presupuesto, saldo`,
      [totalVenta, portfolioId]
    )

    await client.query('COMMIT')

    const portfolio = updatedPortfolio.rows[0]

    res.status(201).json({
      ok: true,
      message: 'Venta registrada',
      portfolio: {
        ...portfolio,
        presupuesto: Number(portfolio.presupuesto),
        saldo: Number(portfolio.saldo)
      },
      total: totalVenta,
      ganancia
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error registrando venta:', error)

    res.status(500).json({
      ok: false,
      message: 'No fue posible registrar la venta'
    })
  } finally {
    client.release()
  }
})

app.listen(PORT,'0.0.0.0',()=>{

    console.log('===================================')
    console.log(' StockVision API')
    console.log(' PostgreSQL conectado')
    console.log(' Puerto:',PORT)
    console.log('===================================')

})
