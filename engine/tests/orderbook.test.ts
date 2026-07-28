import {describe, test, expect} from 'bun:test'
import { Orderbook } from '../trade/orderbook'

describe('Simple order', ()=>{
    test('Empty orderbook should not be filled',()=>{
        const orderbook = new Orderbook('TATA',[],[],0,0)
        const order = {
            price:1000,
            quantity:1,
            orderId:'1',
            filled:0,
            side:'buy' as ('buy' | 'sell'),
            userId:'1'
        }
        const {fills, executedQty} = orderbook.allOrder(order)
        expect(fills.length).toBe(0)
        expect(executedQty).toBe(0)
    })
    test('Can be partially filled',()=>{
        const orderbook = new Orderbook('TATA',[{
            price:1000,
            quantity:1,
            orderId:'1',
            filled:0,
            side:'buy' as ('buy' | 'sell'),
            userId:'1'

        }],[],0,0)

        const order = {
            price:1000,
            quantity:2,
            orderId:'2',
            filled:0,
            side:'sell' as ('buy' | 'sell'),
            userId:'2'
        }

        const {fills , executedQty} = orderbook.allOrder(order)
        expect(fills.length).toBe(1)
        expect(executedQty).toBe(1)
    })

    test('Can be partially filled',()=>{
        const orderbook = new Orderbook('TATA',[{
            price:999,
            quantity:1,
            orderId:'1',
            filled:0,
            side:'buy' as ('buy' | 'sell'),
            userId:'1'
        }],[{
            price:1001,
            quantity:1,
            orderId:'2',
            filled:0,
            side:'sell' as ('buy' | 'sell'),
            userId:'2'
        }],0,0)

        const order = {
            price:1001,
            quantity:2,
            orderId:'3',
            filled:0,
            side:'buy' as ('buy' | 'sell'),
            userId:'3'
        }

        const { fills,executedQty} = orderbook.allOrder(order)
        expect(fills.length).toBe(1)
        expect(executedQty).toBe(1)
        expect(orderbook.bids.length).toBe(2)
        expect(orderbook.asks.length).toBe(0)
    })
})

describe('Self trade prevention',()=>{
    test('User cant self trade',()=>{
        const orderbook = new Orderbook('TATA',[{
            price:999,
            quantity:1,
            orderId:'1',
            filled:0,
            side:'buy' as ('buy' | 'sell'),
            userId:'1'
        }],[{
            price:1001,
            quantity:1,
            orderId:'2',
            filled:0,
            side:'sell' as ('buy' | 'sell'),
            userId:'2'
        }],0,0)

        const order = {
            price:999,
            quantity:2,
            orderId:'3',
            filled:0,
            side:'sell' as ('buy' | 'sell'),
            userId:'3'
        }

        const { fills, executedQty} = orderbook.allOrder(order)
        expect(fills.length).toBe(0)
        expect(executedQty).toBe(0)
    })
})

describe('Precision errors are taken care of',()=>{
    test('Bid doesnt persist even with decimals',()=>{
        const orderbook = new Orderbook('TATA',[{
            price:999,
            quantity:0.773738,
            orderId:'1',
            filled:0,
            side:'buy' as ('buy'| 'sell'),
            userId:'1'
        }],[{
            price:1001,
            quantity:0.551,
            orderId:'2',
            filled:0,
            side:'sell' as ('buy' | 'sell'),
            userId:'2'
        }],0,0)

        const order = {
            price:999,
            quantity:0.551177,
            orderId:'3',
            filled:0,
            side:'sell' as ('buy' | 'sell'),
            userId:'3'
        }

        const {fills,executedQty} = orderbook.allOrder(order)
        expect(fills.length).toBe(1)
        expect(orderbook.bids.length).toBe(0)
        expect(orderbook.asks.length).toBe(1)
    })
})