import { send } from "process"
import { RedisManager } from "../redismanager"
import { CANCEL_ORDER, CREATE_ORDER, GET_DEPTH, GET_OPEN_ORDERS, ON_RAMP } from "../types/fromApi"
import { Orderbook, type Fill, type Order } from "./orderbook"
import fs from 'fs'
import { ORDER_UPDATE, TRADE_ADDED } from "../types"


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

        this.updateBalance(userId,baseAsset,quoteAsset,side,fills,executedQty)
        this.createDbtrades(fills,market,userId)
        this.updateDbOrders(order,executedQty,fills,market)
        this.publishWsDepthUpdates(fills,price,side,market)
        this.publishWsTrades(fills,userId,market)

        return {executedQty,fills,orderId:order.orderId }


        
    }

    updateDbOrders(order:Order,executedQty:number,fills:Fill[],market:string){
        RedisManager.getInstance().pushMessage({
            type: ORDER_UPDATE,
            data:{
                orderId:order.orderId,
                executedQty:executedQty,
                market:market,
                price:order.price.toString(),
                quantity:order.quantity.toString(),
                side:order.side

            }
        })
        fills.forEach(fill => {
            RedisManager.getInstance().pushMessage({
                type: ORDER_UPDATE,
                data:{
                    orderId:fill.marketOrderId,
                    executedQty:fill.qty
                }
            })
        })
    }

    createDbTrades(fills:Fill[],market:string,userId:string){
        fills.forEach(fill => {
            RedisManager.getInstance().pushMessage({
                type: TRADE_ADDED,
                data:{
                    market:market,
                    id:fill.tradeId.toString(),
                    isBuyerMaker:fill.otherUserId === userId,
                    price:fill.price,
                    quantity:fill.qty.toString(),
                    quoteQuantity:(fill.qty*Number(fill.price)).toString(),
                    timestamp:Date.now()
                }
            })
        })
    }

    publishWsTrades(fills:Fill[],userId:string,market:string){
        fills.forEach(fill => {
            RedisManager.getInstance().publishMessage(`trade@${market}`,{
                stream:`trade@${market}`,
                data:{
                    e:'trade',
                    t:fill.tradeId,
                    m:fill.otherUserId === userId,
                    p:fill.price,
                    q:fill.qty.toString(),
                    s:market
                }
            }
            )
        })
    }

    sendUpdatedDepthAt(price:string,market:string){
        const orderbook = this.orderbook.find(o=>o.ticker() === market)
        if(!orderbook){
            return
        }
        const depth = orderbook.getDepth()
        const updatedBids = depth?.bids.filter(x => x[0] === price)
        const updatedAsks = depth.asks.filter(x => x[0] === price)

        RedisManager.getInstance().publishMessage(`depth@${market}`,{
            stream:`depth@${market}`,
            data:{
                a:updatedAsks.length ? updatedAsks : [[price, '0']],
                b:updatedBids.length ? updatedBids : [[price,'0']],
                e:'depth'
            }
        })
    }

    publishWsDepthUpdates(fills:Fill[],price:string,side: 'buy' | 'sell',market:string){
        const orderbook = this.orderbook.find(o => o.ticker() === market)
        if(!orderbook){
            return
        }

        const depth = orderbook.getDepth()
        if(side === 'buy'){
            const updatedAsks = depth.asks.filter(x => fills.map(f => f.price).includes(x[0].toString()))
            const updatedBid = depth.bids.find(x => x[0] === price)

            RedisManager.getInstance().publishMessage(`depth@${market}`,{
                stream:`depth@${market}`,
                data: {
                    a: updatedAsks,
                    b: updatedBid ? [updatedBid] : [],
                    e:'depth'
                }
            })
        }

        if(side === 'sell'){
            const updatedBids = depth.bids.filter(x => fills.map(f => f.price).includes(x[0].toString()))
            const updatedAsk = depth.asks.find(x => x[0] === price)

            RedisManager.getInstance().publishMessage(`depth@${market}`,{
                stream:`depth@${market}`,
                data:{
                    a:updatedAsk ? [updatedAsk] : [],
                    b:updatedBids,
                    e:'depth'
                }
            })
        }

    }

    updateBalance(userId:string,baseAsset:string,quoteAsset:string,side: 'buy' | 'sell', fills:Fill[],executedQty:number){
        if(side === 'buy'){
            fills.forEach(fill => {
                this.balance.get(fill.otherUserId)[quoteAsset]?.available = this.balance.get(fill.otherUserId).[quoteAsset].available + (fill.qty * fill.price)
                this.balance.get(userId)[quoteAsset]?.locked = this.balance.get(userId).[quoteAsset].locked - (fill.qty * fill.price)
                this.balance.get(fill.otherUserId)[baseAsset]?.locked = this.balance.get(fill.otherUserId).[baseAsset].locked - fill.qty
                this.balance.get(userId)[baseAsset]?.available = this.balance.get(userId).[baseAsset].available + fill.qty
            })
        }
        else {
            fills.forEach(fill => {
                this.balance.get(fill.otherUserId)[quoteAsset]?.locked = this.balance.get(fill.otherUserId).[quoteAsset].locked - (fill.qty * fill.price)
                this.balance.get(userId)[quoteAsset]?.available = this.balance.get(userId).[quoteAsset].available + (fill.qty * fill.price)
                this.balance.get(fill.otherUserId)[baseAsset]?.available = this.balance.get(fill.otherUserId).[baseAsset].available + fill.qty
                this.balance.get(userId)[baseAsset]?.locked = this.balance.get(userId).[baseAsset].locked - (fill.qty)
            })
        }
    }

    checkAndLockFunds(baseAsset:string,quoteAsset:string,side:'buy' | 'sell',userId:string,asset:string,price:string,quantity:string){
        if(side === 'buy'){
            if((this.balance.get(userId).[quoteAsset].available || 0) < Number(quantity) * Number(price)){
                throw new Error('Insufficient funds')
            }

            this.balance.get(userId)[quoteAsset]?.available = this.balance.get(userId).[quoteAsset].available - (Number(quantity) * Number(price))
            this.balance.get(userId)[quoteAsset]?.locked = this.balance.get(userId).[quoteAsset].locked + (Number(quantity) * Number(price))

        } 
        else {
            if((this.balance.get(userId).[baseAsset].available || 0) < Number(quantity)){
                throw new Error('Insufficient funds')
            }

            this.balance.get(userId)[baseAsset]?.available = this.balance.get(userId).[baseAsset].available - (Number(quantity))
            this.balance.get(userId)[baseAsset]?.locked = this.balance.get(userId).[baseAsset].locked + Number(quantity)
        }
    }

    onRamp(userId:string,amount:number){
        const userBalance = this.balance.get(userId)
        if(!userBalance){
            this.balance.set(userId,{
                [BASE_CURRENCY]:{
                    available:amount,
                    locked:0
                }
            })
        } else {
            userBalance[BASE_CURRENCY]?.available += amount
        }
    }

    setBaseBalances() {
        this.balance.set('1',{
            [BASE_CURRENCY]:{
                available:10000000,
                locked:0
            },
            'TATA':{
                available:10000000,
                locked:0
            }
        })
        this.balance.set('2',{
            [BASE_CURRENCY]:{
                available:10000000,
                locked:0
            },
            'TATA':{
                available:10000000,
                locked:0
            }
        })
        this.balance.set('5',{
            [BASE_CURRENCY]:{
                available:10000000,
                locked:0
            },
            'TATA':{
                available:10000000,
                locked:0
            }
        })
    }
}