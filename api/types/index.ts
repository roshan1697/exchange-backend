export const CREATE_ORDER = "CREATE_ORDER"
export const CANCEL_ORDER = 'CANCEL_ORDER'
export const ON_RAMP = 'ON_RAMP'
export const GET_OPEN_ORDERS = 'GET_OPEN_ORDER'
export const GET_DEPTH = 'GET_DEPTH'

export type MessageFromOderBook = {
    type:'DEPTH',
    payload:{
        market:string,
        bids:[string,string][],
        asks:[string,string][]
    }
} | {
    type:'ORDER_PLACED',
    payload: {
        orderId:string,
        executedQty:number,
        fills:[
            {
                price:string,
                qty:number,
                tradeId:number
            }
        ]
    }
} | {
    type: 'ORDER_CANCELLED',
    payload:{
        orderId:string,
        executedQty:number,
        remainingQty:number
    }
} | {
    type:'OPEN_ORDERS',
    payload: {
        orderId: string,
        executedQty:number,
        price:string,
        side: 'buy' | 'sell',
        userId:string
    }[]
}