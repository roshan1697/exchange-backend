import { describe, expect, test } from "bun:test";
import request from "supertest";
import app from "../app";

describe("GET /api/v1/depth", () => {
    test("should return 400 if market symbol is missing", async () => {
        const res = await request(app).get("/api/v1/depth")
        expect(res.status).toBe(400)
    })

    test("should return bids and asks for a valid market", async () => {
        const res = await request(app).get("/api/v1/depth?market=BTC_INR")
        expect(res.status).toBe(200)
        expect(res.body.bids).toBeInstanceOf(Array)
        expect(res.body.asks).toBeInstanceOf(Array)
    })
})