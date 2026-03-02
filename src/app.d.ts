/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        OPENAI_API_KEY?: string;
      };
    }
  }
}

export {};
