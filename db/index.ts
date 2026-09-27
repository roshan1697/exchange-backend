import { Client } from "pg";
import { createClient } from "redis";
import type { DbMessage } from "./type";

const client = new Client({
    user: 'your_user',
    host: 'localhost',
    database: 'my_database',
    password: 'your_password',
    port: 5432,
})


const main = async() => {
    await client.connect()
    console.log('db processor connected to Postgres')

    const redisClient = createClient({ url: process.env.REDIS_URL })
    redisClient.on('error', (err) => console.log('Redis client error', err))
    await redisClient.connect()

    console.log('db processor is listening on the "db_processor" queue')

    let shuttingDown = false
    const shutdown = async () => {
        if (shuttingDown) return
        shuttingDown = true
        await redisClient.quit()
        await client.end()
        process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    while(!shuttingDown) {
        try {
            const response = await redisClient.rPop('db_processor' as string)
        if(!response){
            continue
        }
        else {
            const data:DbMessage = JSON.parse(response)
            if(data.type === 'TRADE_ADDED'){
                console.log('adding data')
                console.log(data)
                const price = data.data.price
                const timestamp = new Date(data.data.timestamp)
                const query = 'INSERT INTO tata_prices (time, price) VALUES ($1, $2)';

                const values = [timestamp, price]
                await client.query(query,values)
            }
        }
        } catch (error) {
            console.log('Error while processing db_processor message', error)

        }
    
    }

}

main().catch((error) => {
    console.log('Fatal error in db processor', error)
    process.exit(1)
})
