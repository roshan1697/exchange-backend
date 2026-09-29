import { WebSocketServer } from "ws";
import { UserManager } from "./usermanager";


const wss = new WebSocketServer({port:3001})

wss.on('connection',(ws)=>{
        UserManager.getInstance().addUser(ws)

})

console.log(`WS server is running on port 3001`)