// DEPRECATED & REMOVED
// This file contained the tryAcquirePaymentLock logic which caused permanent PgBouncer transaction-pool lock leaks.
// All payment webhooks now rely entirely on the native ACID row locks inside the `process_invoice_settlement` RPC.
// Do not re-add session-level locking here.