import express from 'express'

const app = express()
app.use(express.json())
app.post('/run',(req,res) => {

})

app.listen('4001',() => console.log('Engine is running in 4001'))