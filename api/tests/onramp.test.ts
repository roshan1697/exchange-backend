import { describe, expect, test } from "bun:test";
import request from "supertest";
import app from "../app";

describe("POST /api/v1/onramp/inr", () => {
    test("should reject missing payload data", async () => {
        const res = await request(app).post("/api/v1/onramp").send({})
        expect(res.status).toBe(400)
    })

    test("should reject amounts below minimum threshold", async () => {
        const res = await request(app).post("/api/v1/onramp").send({
            userId: "user-1",
            amount: 50 
        })
        expect(res.status).toBe(400)
    })

    test("should successfully queue an on-ramp request", async () => {
        const res = await request(app).post("/api/v1/onramp").send({
            userId: "user-1",
            amount: 15000
        })
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })
})