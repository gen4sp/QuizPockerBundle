/**
 * QuizPoker Bundle - Main entry point
 */

import { BundleOptions, QuizPokerConfig } from "./types";
import { Logger } from "./utils/logger";

export class QuizPokerBundle {
    private config: QuizPokerConfig;
    private logger: Logger;

    constructor(config: QuizPokerConfig, options: BundleOptions = {}) {
        this.config = config;
        this.logger = new Logger(options.logLevel || "info");

        this.logger.debug("QuizPokerBundle initialized", { config, options });
    }

    public getName(): string {
        return this.config.name;
    }

    public getVersion(): string {
        return this.config.version;
    }

    public greet(): string {
        const message = `Hello from ${this.config.name} v${this.config.version}!`;
        this.logger.info("Greeting message generated", { message });
        return message;
    }
}

// If this file is run directly
if (require.main === module) {
    const config: QuizPokerConfig = {
        name: "QuizPokerBundle",
        version: "1.0.0",
    };

    const bundle = new QuizPokerBundle(config, {
        logLevel: "info",
        enableDebug: false,
    });

    console.log(bundle.greet());
}

export default QuizPokerBundle;
