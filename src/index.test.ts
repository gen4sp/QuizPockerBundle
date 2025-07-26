import { describe, it, expect } from "vitest";
import { QuizPokerBundle } from "./index";
import { QuizPokerConfig } from "./types";

describe("QuizPokerBundle", () => {
    const config: QuizPokerConfig = {
        name: "TestBundle",
        version: "2.0.0",
    };

    it("should create instance with correct config", () => {
        const bundle = new QuizPokerBundle(config);
        expect(bundle.getName()).toBe("TestBundle");
        expect(bundle.getVersion()).toBe("2.0.0");
    });

    it("should generate correct greeting message", () => {
        const bundle = new QuizPokerBundle(config);
        const greeting = bundle.greet();
        expect(greeting).toBe("Hello from TestBundle v2.0.0!");
    });

    it("should work with default options", () => {
        const bundle = new QuizPokerBundle(config, { logLevel: "error" });
        expect(bundle.getName()).toBe("TestBundle");
    });
});
