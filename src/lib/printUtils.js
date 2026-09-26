// Opens a clean, print-PREVIEW window for any record (Quotation / Order /
// Customer). Kept separate from the on-screen HTML so printing never
// captures the sidebar, modals-behind-modals, or app chrome — only the
// record itself, with the company letterhead applied consistently.
//
// The window shows a preview first (with a sticky "Print" button) — it does
// NOT auto-trigger the browser print dialog, so the person can review the
// formatted document before deciding to print it.

import logoUrl from '../assets/logo.jpeg'

const COMPANY_NAME = 'Chauhan MIS Automation Service'
const COMPANY_TAGLINE = 'Lead to Order · Track · Follow Up · Convert'

export function printRecord(title, bodyHtml, docMeta = {}) {
  const win = window.open('', '_blank', 'width=850,height=960')
  if (!win) {
    alert('Please allow pop-ups for this site to print.')
    return
  }

  const { docName = '', docNumber = '' } = docMeta

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            color: #171b2e;
            margin: 0;
            background: #eef0f6;
          }
          .print-actions {
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 10px;
            padding: 14px 20px;
            background: #171b2e;
          }
          .print-actions .preview-tag {
            color: rgba(255,255,255,0.55);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin-right: auto;
          }
          .print-actions button {
            border: none;
            border-radius: 8px;
            padding: 9px 18px;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
          }
          .print-btn-primary { background: #0EA99A; color: #fff; }
          .print-btn-ghost { background: rgba(255,255,255,0.1); color: #fff; }
          .print-page {
            max-width: 780px;
            margin: 24px auto 40px;
            background: #fff;
            padding: 36px;
            border-radius: 10px;
            box-shadow: 0 6px 24px rgba(23,27,46,0.12);
          }
          .print-brand {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #171b2e;
            padding-bottom: 16px;
            margin-bottom: 20px;
            gap: 16px;
          }
          .print-brand-left { display: flex; align-items: center; gap: 12px; }
          .print-brand-left img { width: 46px; height: 46px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
          .print-brand h1 { font-size: 18px; margin: 0; line-height: 1.25; }
          .print-brand .print-brand-sub { font-size: 11.5px; color: #6c7390; margin-top: 2px; }
          .print-doc-title { text-align: right; flex-shrink: 0; }
          .print-doc-title .print-doc-name { font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
          .print-doc-title .print-doc-number { font-size: 13px; color: #6c7390; margin-top: 2px; }
          h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; color: #6c7390; margin: 22px 0 8px; border-bottom: 1px solid #e2e5ee; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e5ee; font-size: 13px; }
          th { background: #f5f6fa; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: #6c7390; font-weight: 600; }
          td.num, th.num { text-align: right; }
          .print-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-bottom: 4px; }
          .print-meta-grid > div { font-size: 13px; display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e5ee; padding: 5px 0; }
          .print-meta-grid > div span:first-child { color: #6c7390; }
          .print-meta-grid > div span:last-child, .print-meta-grid > div strong { font-weight: 600; }
          .print-totals { margin-left: auto; width: 280px; }
          .print-totals div { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; }
          .print-totals .print-grand { border-top: 2px solid #171b2e; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 700; }
          .print-badge { display: inline-block; padding: 3px 11px; border-radius: 100px; font-size: 11px; font-weight: 700; background: #eef1fb; color: #3a4a9f; }
          .print-notes { font-size: 13px; color: #333; white-space: pre-wrap; margin: 0; }
          .print-footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e5ee; font-size: 11px; color: #9aa0b4; text-align: center; }
          @media print {
            body { background: #fff; }
            .print-actions { display: none; }
            .print-page { box-shadow: none; margin: 0 auto; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        <div class="print-actions">
          <span class="preview-tag">Print Preview</span>
          <button class="print-btn-primary" onclick="window.print()">🖨 Print</button>
          <button class="print-btn-ghost" onclick="window.close()">✕ Close</button>
        </div>
        <div class="print-page">
          <div class="print-brand">
            <div class="print-brand-left">
              <img src="${logoUrl}" alt="Company logo" />
              <div>
                <h1>${COMPANY_NAME}</h1>
                <div class="print-brand-sub">${COMPANY_TAGLINE}</div>
              </div>
            </div>
            <div class="print-doc-title">
              <div class="print-doc-name">${docName}</div>
              <div class="print-doc-number">${docNumber}</div>
            </div>
          </div>
          ${bodyHtml}
          <div class="print-footer">${COMPANY_NAME} — printed on ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
}

export function moneyFmt(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN')}`
}

export function dateFmt(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
