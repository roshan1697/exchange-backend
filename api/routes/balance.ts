import {Router} from 'express'

export const balanceRouter = Router()

balanceRouter.get('/',async(req,res)=>{
    try {
        const userId = "test-user-123"; 

    
        const balances = {
            USD: { available: 15000.00, locked: 500.00 },
            BTC: { available: 1.25, locked: 0.1 }
        };

        
        res.status(200).json({
            success: true,
            balances
        });
    } catch (error) {
        console.error("[Balances API Error]:", error);
        res.status(500).json({ success: false, error: "Internal server error" })
    }
})