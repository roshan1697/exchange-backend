import { Router } from "express";

export const tradeRoute = Router()

tradeRoute.get('/', async(req,res)=>{
    const {market} = req.query
    res.json({})
})