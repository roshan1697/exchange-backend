import { Router } from "express";
import { RedisManager } from "../redismanager";
import { CANCEL_ORDER, CREATE_ORDER, GET_OPEN_ORDERS } from "../types";


export const orderRouter = Router()

orderRouter.post('/', async (req, res) => {
    const { market, price, quantity, side, userId } = req.body

    if (!market || !price || !quantity || !userId || (side !== 'buy' && side !== 'sell')) {
        return res.status(400).json({ error: 'market, price, quantity, side (buy|sell) and userId are required' })
    }
    if (Number.isNaN(Number(price)) || Number(price) <= 0 || Number.isNaN(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: 'price and quantity must be positive numbers' })
    }

    const response = await RedisManager.getInstance().sendAndAwait({
        type: CREATE_ORDER,
        data: {
            market: market,
            price: price,
            quantity: quantity,
            side: side,
            userId: userId
        }
    })

    if (response.type === 'ERROR') {
        return res.status(400).json({ error: response.payload.message })
    }
    res.json(response.payload)
})

orderRouter.get('/open', async (req, res) => {

    const { userId, market } = req.query

    if(!userId || !market){
        return res.status(400).json({ error: 'userId and market query params are required' })
    }

    const response =await RedisManager.getInstance().sendAndAwait({
        type:GET_OPEN_ORDERS,
        data: {
            userId:userId as string,
            market:market as string
        }
    })
    res.json(response.payload)
})

orderRouter.delete('/', async(req,res)=>{
    const { orderId , market, userId } = req.body

    if(!orderId || !market || !userId){
        return res.status(400).json({ error: 'orderId, market and userId are required' })
    }

    const response = await RedisManager.getInstance().sendAndAwait({
        type:CANCEL_ORDER,
        data:{
            orderId,
            market,
            userId
        }
    })

    if(response.type === 'ERROR'){
        return res.status(400).json({ error: response.payload.message })
    }
    res.json(response.payload)
})