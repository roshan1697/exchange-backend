import { Router } from "express";
import { Client } from "pg";



const pgClient = new Client({
    user: 'your_user',
    host: 'localhost',
    database: 'my_database',
    password: 'your_password',
    port: 5432,
})

pgClient.connect()

export const tickerRouter = Router()

tickerRouter.get('/', async(req,res)=>{
    const { market } = req.query

    if(!market){
        return res.status(400).json({ error: "'market' query param is required" })
    }

    try {
        const result = await pgClient.query(`
            SELECT
                (SELECT price FROM tata_prices ORDER BY time DESC LIMIT 1) AS last_price,
                MAX(price) AS high,
                MIN(price) AS low,
                SUM(volume) AS volume
            FROM tata_prices
            WHERE time >= NOW() - INTERVAL '24 hours'
        `)
        const row = result.rows[0]
        res.json({
            market,
            lastPrice: row?.last_price ?? null,
            high: row?.high ?? null,
            low: row?.low ?? null,
            volume: row?.volume ?? 0
        })
    } catch (err) {
        console.log('[Ticker API Error]:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})