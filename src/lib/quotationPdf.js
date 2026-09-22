import { jsPDF } from 'jspdf'

export function generateQuotationPDF(quotation) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  // Header
  doc.setFillColor(23, 28, 51)
  doc.rect(0, 0, pageWidth, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Wavexa Lead Generation', 14, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Lead to Order · Track · Follow Up · Convert', 14, 22)

  // Title + number
  doc.setTextColor(20, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('QUOTATION', 14, 46)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Quotation No: ${quotation.quotation_number}`, 14, 54)
  doc.text(`Date: ${new Date(quotation.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 60)
  if (quotation.valid_until) {
    doc.text(`Valid Until: ${new Date(quotation.valid_until).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 66)
  }

  // Bill to
  doc.setFont('helvetica', 'bold')
  doc.text('Quotation For:', 14, 80)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.company || quotation.lead?.lead_name || '—', 14, 87)

  // Description / amount box
  doc.setDrawColor(220, 220, 220)
  doc.rect(14, 98, pageWidth - 28, 40)
  doc.setFont('helvetica', 'bold')
  doc.text('Description', 18, 106)
  doc.setFont('helvetica', 'normal')
  const descLines = doc.splitTextToSize(quotation.description || '—', pageWidth - 40)
  doc.text(descLines, 18, 113)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(
    `Total Amount: Rs. ${Number(quotation.amount || 0).toLocaleString('en-IN')}`,
    18,
    132
  )

  // Terms
  if (quotation.terms) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Terms & Notes:', 14, 150)
    doc.setFont('helvetica', 'normal')
    const termLines = doc.splitTextToSize(quotation.terms, pageWidth - 28)
    doc.text(termLines, 14, 157)
  }

  // Footer
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text('This is a system-generated quotation from Wavexa Lead Generation.', 14, 285)

  doc.save(`${quotation.quotation_number}.pdf`)
}
