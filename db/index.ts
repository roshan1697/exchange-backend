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

client.connect()

const main = async() => {
    const redisClient = createClient()
    await redisClient.connect()

    while(true) {
        const response = await redisClient.rPop('db_processor' as string)
        if(!response){

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
    }

}