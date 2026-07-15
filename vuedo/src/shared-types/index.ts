// Shared types between Vue template props and the Elysia TypeBox schema.
// Keep these in sync with src/server/index.ts validation.

export interface InvoiceData {
  id: string;
  customerName: string;
}

// Add additional template data interfaces here as new templates are authored.
