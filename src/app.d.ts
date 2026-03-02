/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Locals {
      user: {
        id: string;
        email?: string;
        source: 'access' | 'dev';
      } | null;
    }

    interface Platform {
      env: {
        DB: D1Database;
        OPENAI_API_KEY?: string;
      };
    }
  }
}

export {};
