/**
 * "Dev outbox": when no email provider is configured, verification codes and reset links are shown on screen so the
 * app can be used and tested locally. It is ON automatically outside production, and in production ONLY when
 * NARGITO_DEV_OUTBOX=1 is set explicitly (used by the end-to-end test run). Never enable it on a public site.
 */
export const devOutboxEnabled = () => process.env.NODE_ENV !== "production" || process.env.NARGITO_DEV_OUTBOX === "1";
