import { describe, expect, test } from "bun:test";
import request from "supertest";
import app from "../app";

describe("POST /api/v1/order", () => {
    const validOrder = {
        market: "BTC_INR",
        price: 5000000,
        quantity: 0.5,
        side: "buy" // or "sell"
    };

    test("should successfully place a limit order", async () => {
        const res = await request(app).post("/api/v1/order").send(validOrder)
        expect(res.status).toBe(200)
        expect(res.body.data.orderId).toBeDefined()
    })

    test("should reject negative prices", async () => {
        const res = await request(app).post("/api/v1/order").send({
            ...validOrder,
            price: -100
        })
        expect(res.status).toBe(400)
    })

    test("should reject invalid market pairs", async () => {
        const res = await request(app).post("/api/v1/order").send({
            ...validOrder,
            market: "INVALID_MARKET"
        })
        expect(res.status).toBe(400)
    })
})

describe("DELETE /api/v1/order", () => {
    test("should require an orderId to cancel", async () => {
        const res = await request(app).delete("/api/v1/order").send({ market: "BTC_INR" })
        expect(res.status).toBe(400)
    })
})