import { Client } from "pg";

const client = new Client({
    user:'your_user',
    host:'localhost',
    database:'my_database',
    password:'your_password',
    port: 5432
})
client.connect()

const refreshView = async() => {

    await client.query('REFRESH MATERIALIZED VIEW klines_1m')
    await client.query('REFRESH MATERIALIZED VIEW klines_1h')
    await client.query('REFRESH MATERIALIZED VIEW klines_1w')

    console.log("Materialized views refreshed successfully")


}

refreshView().catch(console.error)

setInterval(()=>{
    refreshView()
},1000*10)