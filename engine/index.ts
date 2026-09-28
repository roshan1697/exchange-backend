import { createClient } from 'redis'
import { Engine } from './trade/Engine'

const engine = new Engine()

const  main = async() => {
    const redisClient = createClient()
    redisClient.on('error', (err) => console.log('Redis client error', err))
    await redisClient.connect()

    console.log('Engine is listening on the "messages" queue')

    let shuttingDown = false
    const shutdown = async () => {
        if (shuttingDown) return
        shuttingDown = true
        console.log('Shutting down engine, saving final snapshot...')
        engine.saveSnapshot()
        await redisClient.quit()
        process.exit(0)
    }
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    while (!shuttingDown) {
        try {
            const response = await redisClient.brPop('messages', 0)
            if (!response) {
                continue
            }
            const { clientId, message } = JSON.parse(response.element)
            engine.process({ message, clientId })
        } catch (error) {
            console.log('Error while processing queue message', error)
        }
    }
}

main()
