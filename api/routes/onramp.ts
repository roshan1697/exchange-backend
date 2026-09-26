import { Router } from "express";
import { RedisManager } from "../redismanager";
import { ON_RAMP } from "../types";

export const onRampRouter = Router()

const userBalances: Record<string, { INR: { available: number; locked: number } }> = {
    "test-user-123": { INR: { available: 50000, locked: 0 } }
}

interface OnRampRequestBody {
    userId: string;
    amount: number;
    txnId?: string;
}


onRampRouter.post('/inr', async (req, res) => {
    try {
        const { userId, amount, txnId }: OnRampRequestBody = req.body;

        if (!userId || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: "Invalid payload. 'userId' is required and 'amount' must be a positive number."
            });
        }

        if (amount < 100) {
            return res.status(400).json({
                success: false,
                error: "Minimum on-ramp amount is ₹100."
            });
        }


        const response = await RedisManager.getInstance().sendAndAwait({
            type: ON_RAMP,
            data: {
                userId,
                amount: amount.toString(),
                txnId: txnId || `txn_${Date.now()}`
            }
        })

        if (response.type === 'ERROR') {
            return res.status(400).json({ success: false, error: response.payload.message })
        }

        res.status(200).json({
            success: true,
            message: `Successfully on-ramped ₹${amount.toLocaleString('en-IN')}`,
            data: {
                userId,
                creditedAmount: amount,
                txnId: txnId || `txn_${Date.now()}`,
                balance: response.type === 'BALANCE' ? response.payload: undefined
            }
        });
    } catch (error) {
        console.error("[On-Ramp API Error]:", error)
        res.status(500).json({ success: false, error: "Internal server error during on-ramp processing." })
    }
})