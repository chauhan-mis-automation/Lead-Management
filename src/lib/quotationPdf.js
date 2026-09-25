import { jsPDF } from 'jspdf'

export function generateQuotationPDF(quotation, items = []) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 14

  // Header
  doc.setFillColor(23, 28, 51)
  doc.rect(0, 0, pageWidth, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Wavexa Lead Generation', marginX, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Lead to Order · Track · Follow Up · Convert', marginX, 22)

  // Title + number
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('QUOTATION', marginX, 46)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Quotation No: ${quotation.quotation_number}`, marginX, 54)
  doc.text(`Date: ${new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, marginX, 60)
  if (quotation.valid_until) {
    doc.text(`Valid Until: ${new Date(quotation.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, marginX, 66)
  }

  // Bill to
  doc.setFont('helvetica', 'bold')
  doc.text('Quotation For:', marginX, 78)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.company || quotation.lead?.lead_name || '—', marginX, 84)
  if (quotation.description) {
    const descLines = doc.splitTextToSize(quotation.description, pageWidth - marginX * 2)
    doc.text(descLines, marginX, 90)
  }

  // ---------- Items table ----------
  const tableTop = 100
  const colX = {
    item: marginX,
    qty: marginX + 78,
    rate: marginX + 100,
    disc: marginX + 128,
    tax: marginX + 148,
    total: pageWidth - marginX
  }

  doc.setFillColor(240, 242, 248)
  doc.rect(marginX, tableTop, pageWidth - marginX * 2, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 70)
  doc.text('Item', colX.item + 2, tableTop + 5.5)
  doc.text('Qty', colX.qty, tableTop + 5.5)
  doc.text('Rate', colX.rate, tableTop + 5.5)
  doc.text('Disc%', colX.disc, tableTop + 5.5)
  doc.text('Tax%', colX.tax, tableTop + 5.5)
  doc.text('Total', colX.total, tableTop + 5.5, { align: 'right' })

  let y = tableTop + 8
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(9)

  const rows = items.length > 0
    ? items
    : [{ item_name: quotation.description || 'Item', quantity: 1, rate: quotation.amount || 0, discount_percent: 0, tax_percent: 0, line_total: quotation.amount || 0 }]

  rows.forEach((it, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(250, 250, 252)
      doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F')
    }
    const nameLines = doc.splitTextToSize(it.item_name || '—', 70)
    doc.text(nameLines[0], colX.item + 2, y + 5)
    doc.text(String(it.quantity), colX.qty, y + 5)
    doc.text(`Rs.${Number(it.rate).toLocaleString('en-IN')}`, colX.rate, y + 5)
    doc.text(`${it.discount_percent}%`, colX.disc, y + 5)
    doc.text(`${it.tax_percent}%`, colX.tax, y + 5)
    doc.text(`Rs.${Number(it.line_total).toLocaleString('en-IN')}`, colX.total, y + 5, { align: 'right' })
    y += 7
  })

  doc.setDrawColor(220, 220, 220)
  doc.line(marginX, y + 2, pageWidth - marginX, y + 2)
  y += 8

  // ---------- Totals ----------
  const totalsX = pageWidth - marginX
  function totalRow(label, value, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 10)
    doc.text(label, totalsX - 55, y)
    doc.text(`Rs.${Number(value).toLocaleString('en-IN')}`, totalsX, y, { align: 'right' })
    y += bold ? 8 : 6
  }

  totalRow('Subtotal', quotation.subtotal ?? quotation.amount ?? 0)
  totalRow('Discount', -(quotation.discount_total || 0))
  totalRow('Tax', quotation.tax_total || 0)
  y += 1
  doc.setDrawColor(23, 28, 51)
  doc.line(totalsX - 55, y - 5, totalsX, y - 5)
  totalRow('Grand Total', quotation.amount || 0, true)

  y += 6

  // Terms
  if (quotation.terms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Terms & Notes:', marginX, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const termLines = doc.splitTextToSize(quotation.terms, pageWidth - marginX * 2)
    doc.text(termLines, marginX, y)
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text('This is a system-generated quotation from Wavexa Lead Generation.', marginX, 285)

  doc.save(`${quotation.quotation_number}.pdf`)
}
