import { send } from "process"
import { RedisManager } from "../redismanager"
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, ON_RAMP } from "../types/fromApi"
import { Orderbook, type Order } from "./orderbook"
import fs from 'fs'


export const BASE_CURRENCY = 'INR'

interface UserBalance {
    [key:string] : {
        available:number,
        locked:number
    }
}

export class Engine {
    private orderbook:Orderbook[] = []
    private balance:Map<string,UserBalance> = new Map()
    constructor() {
        let snapshot = null
        try {
            if(process.env.WITH_SNAPSHOT){
                snapshot = fs.readFileSync('./snapshot.json')
            }
            
        } catch (error) {
            console.log('no snapshot found')
            
        }
        if(snapshot){
            const snapshotSnapshot = JSON.parse(snapshot.toString())
            this.orderbook = snapshotSnapshot.orderbook.map((o)=> new Orderbook(o.baseAsset,o.bids,o.asks,o.lastTradeId,o.currentPrice))
            this.balance = new Map(snapshotSnapshot.balance)
        }
        else {
            this.orderbook = [new Orderbook('TATA',[],[],0,0)]
            this.setBaseBalances()
        }
        setInterval(()=>{
            this.saveSnapshot()
        },3000)
    }

    saveSnapshot() {
        const snapshotSnapshot = {
            orderbook: this.orderbook.map(o=>o.getSnapshot())
        }
    }

    process({message,clientId}) {
        switch(message.type){
            case CREATE_ORDER:
                try {
                    const {executedQty, fills,orderId} = this.createOrder(message.data.market,message.data.price,message.data.quantity,message.data.side,message.data.userId)
                    RedisManager.getInstance().sendToApi(clientId,{
                        type:'ORDER_PLACED',
                        payload:{
                            orderId,
                            executedQty,
                            fills
                        }
                    })
                } catch (error) {
                    console.log(error)
                    RedisManager.getInstance().sendToApi(clientId,
                        {
                            type:'ORDER_CANCELLED',
                            payload:{
                                orderId:'',
                                executedQty:0,
                                remainingQty:0
                            }

                        }
                    )
                    
                }
                break
            case CANCEL_ORDER:
                try {
                    const orderId = message.data.orderId
                    const cancelMarket = message.data.market
                    const cancelOrderbook = this.orderbook.find(o => o.ticker() === cancelMarket)
                    const quoteAsset = cancelMarket.split('_')[1]
                    if(!cancelOrderbook){
                        throw new Error('No orderbook found')
                    }
                    const order  = cancelOrderbook.asks.find(o => o.orderId === orderId) || cancelOrderbook.bids.find(o => o.orderId === orderId)
                    if(!order){
                        throw new Error('No order found')
                    }

                    if(order.side === 'buy'){
                        const price = cancelOrderbook.cancelBid(order)
                        const leftQuantity = (order.quantity - order.filled) * order.price
                        
                        this.balance.get(order.userId)[BASE_CURRENCY].available += leftQuantity
                        this.balance.get(order.userId)[BASE_CURRENCY]?.locked -= leftQuantity
                        if(price){
                            this.sendUpdateDepthAt(price.toString(),cancelMarket)
                        }
                    }
                    else    {
                        const price =cancelOrderbook.cancelAsk(order)
                        const leftQuantity = order.quantity - order.filled

                        this.balance.get(order.userId)[quoteAsset]?.available += leftQuantity
                        this.balance.get(order.userId)[quoteAsset]?.locked -= leftQuantity

                        if(price){
                            this.sendUpdateDepthAt(price.toString(), cancelMarket)
                        }
                    }

                    RedisManager.getInstance().sendToApi(clientId,{
                        type: 'ORDER_CANCELLED',
                        payload:{
                            orderId,
                            executedQty:0,
                            remainingQty:0
                        }
                    })
                } catch (error) {
                    console.log('Error while cancelling order')
                }
                break
            case GET_OPEN_ORDERS:
                try{
                    const openOrderbook = this.orderbook.find(o => o.ticker() === message.data.market)
                    if(!openOrderbook){
                        throw new Error('No orderbook found')
                    }
                    const openOrders = openOrderbook.getOpenOrders(message.data.userId)
                    RedisManager.getInstance().sendToApi(clientId,{
                        type:'OPEN_ORDER',
                        payload:openOrders
                    })
                    }
                catch(error){
                    console.log('Error getting open Order')
                    }
                    break
            case ON_RAMP:
                const userId = message.data.userId
                const amount = Number(message.data.amount)
                this.onRamp(userId,amount)
                break
            case GET_DEPTH:
                try{
                    const market = message.data.market
                    const orderbook = this.orderbook.find(o=>o.ticker() === market)
                    if(!orderbook){
                        throw new Error('No orderbook found')
                    }
                    RedisManager.getInstance().sendToApi(clientId,{
                        type:'DEPTH',
                        payload:orderbook.getDepth()
                    })
                }
                catch(error){
                    RedisManager.getInstance().sendToApi(clientId,{
                        type:'DEPTH',
                        payload:{
                            bids:[],
                            asks:[]
                        }
                    })
                }
                break
        }

    }

    addOrderbook(orderbook:Orderbook){
        this.orderbook.push(orderbook)

    }

    createOrder(market:string,price:string,quantity:string,side:'buy' | 'sell',userId:string){
        
        const orderbook = this.orderbook.find(o => o.ticker()  === market)
        const baseAsset = market.split('_')[0]
        const quoteAsset = market.split('_')[1]

        if(!orderbook) {
            throw new Error('No orderbook found')
        }

        this.checkAndLockFunds(baseAsset,quoteAsset,side,userId,quoteAsset, price,quantity)

        const order:Order = {
            price: Number(price),
            quantity: Number(quantity),
            orderId:Math.random().toString(36).substring(2,15) + Math.random().toString(36).substring(2,15),
            filled:0,
            side,
            userId
        }

        const {fills, executedQty} = orderbook.addOrder(order)
        
    }
    setBaseBalances() {

    }
}