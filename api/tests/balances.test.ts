import { describe, expect, test } from "bun:test";
import request from "supertest";
import app from "../app";

describe("GET /api/v1/balances", () => {
    // test("should require authentication (if implemented)", async () => {
    //     const res = await request(app).get("/api/v1/balance")
    
    // })

    test("should return user balances successfully", async () => {
    

        const res = await request(app)
            .get("/api/v1/balance")
            .set("Authorization", "Bearer mock-token-123")

        console.log(res)

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.balances).toBeDefined()
    })
})