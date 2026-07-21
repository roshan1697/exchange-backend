import {describe, test, expect , mock, spyOn} from 'bun:test'
import { RedisManager } from '../redismanager'
import { Engine } from '../trade/Engine'
import { CREATE_ORDER } from '../types/fromApi'


mock.module('../redismanager',()=>({
    RedisManager: {
        getInstance: () =>({
            publishMessage: mock(),
            sendToApi: mock(),
            pushMessage: mock()

        })
    }
})
)

describe('Engine', ()=> {
    test('Publishes Trade updates',()=>{
        const engine = new Engine()
        const publishSpy = spyOn(engine,'publishWsTrades')
        engine.process({
            message:{
                type: CREATE_ORDER,
                data:{
                    market:'TATA_INR',
                    price:'1000',
                    quantity:'1',
                    side:'buy',
                    userId:'1',

                }
            },
            clientId:'1'
        })
        engine.process({
            message:{
                type: CREATE_ORDER,
                data:{
                    market:'TATA_INR',
                    price:'1001',
                    quantity:'1',
                    side:'sell',
                    userId:'1',

                }
            },
            clientId:'1'
        })
        expect(publishSpy).toHaveBeenCalledTimes(2)
    })
})