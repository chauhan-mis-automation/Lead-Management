// Opens a clean, print-friendly window for any record (Quotation / Order /
// Customer) and triggers the browser's print dialog. Kept separate from the
// on-screen HTML so printing never captures the sidebar, modals-behind-modals,
// or app chrome — only the record itself.

export function printRecord(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=850,height=960')
  if (!win) {
    alert('Please allow pop-ups for this site to print.')
    return
  }

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
            padding: 36px;
            max-width: 780px;
            margin: 0 auto;
          }
          .print-brand {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #171b2e;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .print-brand h1 { font-size: 20px; margin: 0; }
          .print-brand .print-brand-sub { font-size: 12px; color: #6c7390; margin-top: 2px; }
          .print-doc-title { text-align: right; }
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
            body { padding: 0; max-width: none; }
            .print-actions { display: none; }
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
        <div class="print-footer">Wavexa Lead Generation — printed on ${new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 350)
}

export function moneyFmt(v) {
  return `₹${Number(v || 0).toLocaleString('en-IN')}`
}

export function dateFmt(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
