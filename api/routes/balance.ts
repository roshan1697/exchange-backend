import {Router} from 'express'
import { RedisManager } from '../redismanager'
import { GET_BALANCE } from '../types'

export const balanceRouter = Router()

balanceRouter.get('/',async(req,res)=>{
    try {
        const userId = req.query.userId as string

        if(!userId){
            return res.status(400).json({ success: false, error: "'userId' query param is required" })
        }

    
        const response = await RedisManager.getInstance().sendAndAwait({
            type: GET_BALANCE,
            data: { userId }
        })

        if(response.type === 'ERROR'){
            return res.status(400).json({ success: false, error: response.payload.message })
        }

        res.status(200).json({
            success: true,
            balances: response.payload
        });
    } catch (error) {
        console.error("[Balances API Error]:", error);
        res.status(500).json({ success: false, error: "Internal server error" })
    }
})