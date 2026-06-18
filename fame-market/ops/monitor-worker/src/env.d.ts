declare global {
  interface Env {
    CHECK_ATTENTION_SYNC?: 'true' | 'false';
    ATTENTION_MAX_AGE_SECONDS?: string;
  }
}

export {};
