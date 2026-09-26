import { Router } from "express";
import { RedisManager } from "../redismanager";
import { GET_DEPTH } from "../types";

export const depthRouter = Router();

depthRouter.get("/", async (req, res) => {
    const { symbol } = req.query;

    if (!symbol) {
        return res.status(400).json({ error: "'market' query param is required" });
    }
    const response = await RedisManager.getInstance().sendAndAwait({
        type: GET_DEPTH,
        data: {
            market: symbol as string
        }
    });

    res.json(response.payload);
});