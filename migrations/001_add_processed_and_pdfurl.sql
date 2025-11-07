-- Migration: Add 'processed' status and pdfUrl column
-- Date: 2025-11-06
-- Description: Adds 'processed' to status values and pdfUrl column for PDF download URLs

-- Step 1: Add pdfUrl column
ALTER TABLE harvest_items 
ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(1000);

-- Step 2: Add comment to the new column
COMMENT ON COLUMN harvest_items.pdf_url IS 'Direct URL to PDF file for automatic download and processing';

-- Step 3: Create index on pdf_url for faster queries
CREATE INDEX IF NOT EXISTS harvest_items_pdf_url_idx ON harvest_items(pdf_url) WHERE pdf_url IS NOT NULL;

-- Note: PostgreSQL doesn't use ENUM like MySQL, it uses TEXT with CHECK constraints or custom types
-- The current schema uses TEXT for status, so we just need to update the comment to reflect the new value
COMMENT ON COLUMN harvest_items.status IS 'Status: queued|fetched|deduped|stored|skipped|error|processed';
