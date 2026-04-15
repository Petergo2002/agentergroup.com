# PDF & File Preview Improvements

## Overview
The user is experiencing an issue where attempting to preview PDF files (or other file types) in the Knowledge Source base simply displays a generic "Preview Not Available" screen with an external download link. The goal is to provide the "absolute best" premium SaaS experience for viewing these files without leaving the application.

## Project Type
WEB (`frontend-specialist`, `backend-specialist`)

## Analysis of the Bug
The fallback to the external link happens because:
1. The `isPdf` strict check (`content.mimeType === 'application/pdf'`) is failing, likely because the knowledge sync process is setting the mime type to `application/octet-stream` or the browser is failing to reliably map the mime type.
2. Even when `isPdf` succeeds, Native `<iframe>` PDF rendering is inconsistent across browsers, sometimes forcing a download if the headers from Supabase include `Content-Disposition: attachment`.

## Success Criteria
1. PDFs render perfectly inside the `ViewSourceModal` without triggering downloads.
2. The UI feels premium, avoiding the crude native browser PDF viewer chrome.
3. Fallback preview capabilities for other common document types (e.g. `docx`, `csv`).

## Tech Stack & Approach Strategy

### Option A: The Premium Native React Approach (Best for just PDF)
- **Library:** `react-pdf` (Mozilla PDF.js wrapper)
- **Why:** Gives us 100% control over the UI, zooming, and pagination styling to match the platform's glassmorphism and precision UI aesthetics.
- **Trade-off:** Adds to the bundle size and only works for PDFs.

### Option B: The "Universal Document Viewer" Approach (Best for All Formats)
- **Strategy:** Use `https://docs.google.com/viewer?url={url}&embedded=true` via an `iframe`.
- **Why:** Safely renders PDF, DOCX, XLSX, and PPTX without adding heavy JavaScript libraries to our Next.js bundle. Supabase signed URLs are accessible to this service.
- **Trade-off:** Relies on a third-party service and the signed URL must be fully accessible by Google's servers.

### Option C: The Hybrid Approach
- **Backend:** Force `download: false` on `createSignedUrl` in `src/app/api/knowledge/sources/[id]/content/route.ts` to ensure `Content-Disposition: inline`.
- **Frontend:** Improve the `isPdf` wildcard check. Use `<embed>` or `<object>` instead of `<iframe>` for PDFs, which often behaves better for inline viewing.

## File Structure
- `src/app/api/knowledge/sources/[id]/content/route.ts` (API Updates)
- `src/components/modals/ViewSourceModal.tsx` (UI Updates)

## Task Breakdown
1. **Fix Signed URL Headers:** Modify the Supabase storage options to force `download: false` (to render inline instead of as an attachment).
2. **Loosen Mime-Type Checks:** Parse common file extensions from `content.name` as a fallback if `content.mimeType` is generic.
3. **Implement Viewer UI:** Determine the best UI rendering method (React-PDF, Google Docs Viewer, or Native Embed) and implement it.

## Phase X: Verification
- [ ] Attempt to view a known PDF and observe inline rendering instead of a link.
- [ ] Ensure zooming/scrolling works properly on modern browsers.
- [ ] Verify no "blocked frame" or console errors appear due to CSP restrictions.
