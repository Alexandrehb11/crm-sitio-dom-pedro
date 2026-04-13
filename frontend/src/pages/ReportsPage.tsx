import { useQuery } from '@tanstack/react-query'
import { Download, FileText, Users, Calendar, CreditCard, FileDown } from 'lucide-react'
import { leadsApi, eventsApi, paymentsApi } from '@/lib/api'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ─── CSV helper ───────────────────────────────────────────────────────────────

function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const csv = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── PDF helper ───────────────────────────────────────────────────────────────

interface PDFStat {
  label: string
  value: string
}

async function downloadPDF(
  filename: string,
  reportTitle: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  stats?: PDFStat[],
) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.width
  const pageH = doc.internal.pageSize.height
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Belem' })
  const today = new Date().toLocaleDateString('pt-BR')

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  // Barra de topo
  doc.setFillColor(30, 30, 30)
  doc.rect(0, 0, pageW, 18, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Sítio Dom Pedro', 14, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Gerado em ${now}`, pageW - 14, 11, { align: 'right' })

  // Subtítulo do relatório
  doc.setTextColor(30, 30, 30)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(reportTitle, 14, 26)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 100, 100)
  doc.text(`Data: ${today}  •  ${rows.length} registro${rows.length !== 1 ? 's' : ''}`, 14, 31)
  doc.setTextColor(0, 0, 0)

  // ── Resumo estatístico ─────────────────────────────────────────────────────
  let tableStartY = 36

  if (stats && stats.length > 0) {
    tableStartY = 52
    const boxW = 50
    const boxH = 14
    const boxY = 34

    stats.forEach((stat, i) => {
      const x = 14 + i * (boxW + 4)
      doc.setFillColor(245, 245, 245)
      doc.roundedRect(x, boxY, boxW, boxH, 2, 2, 'F')

      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text(stat.value, x + 4, boxY + 7)

      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(stat.label, x + 4, boxY + 12)
      doc.setTextColor(0, 0, 0)
    })
  }

  // ── Tabela ─────────────────────────────────────────────────────────────────
  autoTable(doc, {
    head: [headers],
    body: rows.map((row) => row.map((cell) => String(cell ?? ''))),
    startY: tableStartY,
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 7,
      cellPadding: { top: 2, right: 3, bottom: 2, left: 3 },
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    columnStyles: {},
  })

  // ── Rodapé com número de página ────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Página ${i} de ${totalPages}  •  Sítio Dom Pedro — CRM`,
      pageW / 2,
      pageH - 4,
      { align: 'center' },
    )
    doc.setTextColor(0, 0, 0)
  }

  doc.save(filename)
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { data: leads, isLoading: loadingLeads } = useQuery({
    queryKey: ['leads', ''],
    queryFn: () => leadsApi.list({ limit: 200 }),
  })

  const { data: events, isLoading: loadingEvents } = useQuery({
    queryKey: ['events', ''],
    queryFn: () => eventsApi.list({ limit: 200 }),
  })

  const { data: payments, isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', ''],
    queryFn: () => paymentsApi.list({ limit: 200 }),
  })

  // ── Dados derivados ──────────────────────────────────────────────────────
  const totalLeads = leads?.length ?? 0
  const leadsQuentes = leads?.filter((l) => l.score >= 60).length ?? 0
  const leadsMornos = leads?.filter((l) => l.score >= 30 && l.score < 60).length ?? 0
  const totalEvents = events?.length ?? 0
  const confirmedEvents = events?.filter((e) => e.status === 'confirmado').length ?? 0
  const totalRevenue =
    payments?.filter((p) => p.status === 'pago').reduce((s, p) => s + p.amount, 0) ?? 0
  const pendingRevenue =
    payments?.filter((p) => p.status === 'pendente').reduce((s, p) => s + p.amount, 0) ?? 0

  // ── Builders de linhas ───────────────────────────────────────────────────
  const leadsHeaders = [
    'Nome', 'Telefone', 'E-mail', 'Tipo Evento', 'Data Evento',
    'Convidados', 'Orçamento', 'Canal', 'Score', 'Etapa Funil', 'LGPD', 'Criado em',
  ]
  const leadsRows = () =>
    (leads ?? []).map((l) => [
      l.name, l.phone, l.email ?? '', l.event_type,
      l.event_date ? formatDate(l.event_date) : '',
      l.guest_count ?? '', l.budget ? formatCurrency(l.budget) : '',
      l.source_channel, l.score, l.funnel_stage,
      l.consent_lgpd ? 'Sim' : 'Não',
      formatDateTime(l.created_at),
    ])

  const eventsHeaders = ['Título', 'Lead', 'Início', 'Fim', 'Espaço', 'Convidados', 'Status', 'Criado em']
  const eventsRows = () =>
    (events ?? []).map((e) => [
      e.title, e.lead_name ?? '',
      formatDateTime(e.date_start), formatDateTime(e.date_end),
      e.space, e.guest_count ?? '', e.status,
      formatDateTime(e.created_at),
    ])

  const paymentsHeaders = [
    'Lead', 'Parcela', 'Total Parc.', 'Valor', 'Vencimento', 'Método', 'Status', 'Confirmado em',
  ]
  const paymentsRows = () =>
    (payments ?? []).map((p) => [
      p.lead_name ?? '',
      p.installment_number, p.installment_total,
      formatCurrency(p.amount),
      formatDate(p.due_date),
      p.method, p.status,
      p.confirmed_at ? formatDateTime(p.confirmed_at) : '',
    ])

  const stamp = new Date().toISOString().slice(0, 10)

  // ── Funções de export ────────────────────────────────────────────────────
  function exportLeadsCSV() {
    downloadCSV(`leads_${stamp}.csv`, leadsHeaders, leadsRows())
  }
  async function exportLeadsPDF() {
    await downloadPDF(
      `leads_${stamp}.pdf`,
      'Relatório de Leads',
      leadsHeaders,
      leadsRows(),
      [
        { label: 'Total de leads', value: String(totalLeads) },
        { label: 'Leads quentes', value: String(leadsQuentes) },
        { label: 'Leads mornos', value: String(leadsMornos) },
      ],
    )
  }

  function exportEventsCSV() {
    downloadCSV(`eventos_${stamp}.csv`, eventsHeaders, eventsRows())
  }
  async function exportEventsPDF() {
    await downloadPDF(
      `eventos_${stamp}.pdf`,
      'Relatório de Eventos',
      eventsHeaders,
      eventsRows(),
      [
        { label: 'Total de eventos', value: String(totalEvents) },
        { label: 'Confirmados', value: String(confirmedEvents) },
      ],
    )
  }

  function exportPaymentsCSV() {
    downloadCSV(`pagamentos_${stamp}.csv`, paymentsHeaders, paymentsRows())
  }
  async function exportPaymentsPDF() {
    await downloadPDF(
      `pagamentos_${stamp}.pdf`,
      'Relatório de Pagamentos',
      paymentsHeaders,
      paymentsRows(),
      [
        { label: 'Receita confirmada', value: formatCurrency(totalRevenue) },
        { label: 'Receita pendente', value: formatCurrency(pendingRevenue) },
      ],
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-serif font-semibold">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Visualize resumos e exporte dados em CSV ou PDF</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Leads
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLeads ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{totalLeads}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{leadsQuentes} quentes</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Eventos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingEvents ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{totalEvents}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{confirmedEvents} confirmados</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Receita Confirmada
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" /> Receita Pendente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatCurrency(pendingRevenue)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Export cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Leads
            </CardTitle>
            <CardDescription>
              Score, etapa do funil, canal de origem e dados de contato.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <span className="text-sm text-muted-foreground">
              {loadingLeads ? <Skeleton className="h-4 w-20" /> : `${totalLeads} registros`}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loadingLeads || !leads?.length}
                onClick={exportLeadsCSV}
                className="gap-1.5 flex-1"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingLeads || !leads?.length}
                onClick={exportLeadsPDF}
                className="gap-1.5 flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Eventos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Eventos
            </CardTitle>
            <CardDescription>
              Datas, espaço, status e número de convidados por evento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <span className="text-sm text-muted-foreground">
              {loadingEvents ? <Skeleton className="h-4 w-20" /> : `${totalEvents} registros`}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loadingEvents || !events?.length}
                onClick={exportEventsCSV}
                className="gap-1.5 flex-1"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingEvents || !events?.length}
                onClick={exportEventsPDF}
                className="gap-1.5 flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pagamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Pagamentos
            </CardTitle>
            <CardDescription>
              Valores, vencimentos, métodos e status de cada cobrança.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <span className="text-sm text-muted-foreground">
              {loadingPayments ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                `${payments?.length ?? 0} registros`
              )}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loadingPayments || !payments?.length}
                onClick={exportPaymentsCSV}
                className="gap-1.5 flex-1"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loadingPayments || !payments?.length}
                onClick={exportPaymentsPDF}
                className="gap-1.5 flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              >
                <FileDown className="h-3.5 w-3.5" />
                PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-4">
        <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          CSV: codificação UTF-8 (BOM), separador por vírgula — compatível com Excel e Google Sheets.
          PDF: formato A4 paisagem com cabeçalho, resumo e tabela formatados.
        </p>
      </div>
    </div>
  )
}
