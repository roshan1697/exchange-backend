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

export const tradeRoute = Router()

tradeRoute.get('/', async(req,res)=>{
    const {market, limit} = req.query

    if(!market){
        return res.status(400).json({ error: "'market' query param is required" })
    }

    const rowLimit = Math.min(Number(limit) || 50, 500)

    try {
        const result = await pgClient.query(
            'SELECT time, price, volume FROM tata_prices ORDER BY time DESC LIMIT $1',
            [rowLimit]
        )
        res.json(result.rows.map(row => ({
            time: row.time,
            price: row.price,
            quantity: row.volume
        })))
    } catch (err) {
        console.log('[Trades API Error]:', err)
        res.status(500).json({ error: 'Internal server error' })
    }
})