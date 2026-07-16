import { RedisManager } from "../redismanager"
import { CREATE_ORDER } from "../types/fromApi"
import { Orderbook } from "./orderbook"
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
        }

    }
    createOrder(market:string,price:string,quantity:string,side:'buy' | 'sell',userId:string){
        
    }
    setBaseBalances() {

    }
}