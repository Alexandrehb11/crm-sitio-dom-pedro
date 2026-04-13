import { useRef, useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Loader2, Send, CheckCircle2, Search,
  Paperclip, FileText, Eye, X, Phone, User,
} from 'lucide-react'
import { contractsApi, eventsApi } from '@/lib/api'
import type { ContractOut, ContractCreate, ContractUpdate, ContractStatus } from '@/types'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 10

const STATUS_OPTIONS: { value: ContractStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'assinado', label: 'Assinado' },
  { value: 'executado', label: 'Executado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const STATUS_BADGE: Record<ContractStatus, 'amber' | 'green' | 'pine' | 'coral'> = {
  pendente: 'amber',
  assinado: 'green',
  executado: 'pine',
  cancelado: 'coral',
}

// ─── Utilitário: formata telefone ──────────────────────────────────────────
function fmtPhone(phone: string | null | undefined): string {
  if (!phone) return '—'
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

// ─── Componente: seletor de PDF ────────────────────────────────────────────
function PdfPicker({
  value,
  onChange,
}: {
  value: File | null
  onChange: (f: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept="application/pdf,.pdf"
        ref={ref}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm w-full">
          <FileText className="h-4 w-4 text-green-600 shrink-0" />
          <span className="truncate flex-1">{value.name}</span>
          <button
            type="button"
            onClick={() => { onChange(null); if (ref.current) ref.current.value = '' }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={() => ref.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
          Selecionar PDF do modelo de contrato
        </Button>
      )}
    </div>
  )
}

// ─── Formulário: Criar contrato ────────────────────────────────────────────
const createSchema = z.object({
  event_id: z.string().min(1, 'Selecione um evento'),
  template_type: z.string().min(1, 'Tipo de template obrigatório').max(100),
  client_name: z.string().min(2, 'Nome obrigatório').max(200),
  client_phone: z
    .string()
    .min(8, 'Telefone inválido')
    .max(30)
    .transform((v) => v.replace(/\D/g, '')),
})

type CreateFormValues = z.infer<typeof createSchema>

function CreateContractForm({
  onSubmit,
}: {
  onSubmit: (v: CreateFormValues, pdf: File | null) => Promise<void>
}) {
  const [pdfFile, setPdfFile] = useState<File | null>(null)

  const { data: events } = useQuery({
    queryKey: ['events', ''],
    queryFn: () => eventsApi.list({ limit: 200 }),
  })

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { event_id: '', template_type: '', client_name: '', client_phone: '' },
  })

  const { isSubmitting } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => onSubmit(v, pdfFile))} className="space-y-4">
        {/* Evento */}
        <FormField
          control={form.control}
          name="event_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Evento *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o evento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {events?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Nome do signatário */}
        <FormField
          control={form.control}
          name="client_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Signatário *</FormLabel>
              <FormControl>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Nome completo" className="pl-9" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Telefone */}
        <FormField
          control={form.control}
          name="client_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone / WhatsApp *</FormLabel>
              <FormControl>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="(11) 99999-9999" className="pl-9" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tipo de template */}
        <FormField
          control={form.control}
          name="template_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Contrato *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Casamento — Padrão">Casamento — Padrão</SelectItem>
                  <SelectItem value="Casamento — Premium">Casamento — Premium</SelectItem>
                  <SelectItem value="Corporativo — Padrão">Corporativo — Padrão</SelectItem>
                  <SelectItem value="Debutante — Padrão">Debutante — Padrão</SelectItem>
                  <SelectItem value="Aniversário — Padrão">Aniversário — Padrão</SelectItem>
                  <SelectItem value="Religioso — Padrão">Religioso — Padrão</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* PDF */}
        <FormItem>
          <FormLabel>
            Modelo de Contrato (PDF)
            <span className="ml-1 text-xs text-muted-foreground">(opcional — pode anexar depois)</span>
          </FormLabel>
          <PdfPicker value={pdfFile} onChange={setPdfFile} />
        </FormItem>

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              'Criar Contrato'
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// ─── Formulário: Editar contrato ───────────────────────────────────────────
const editSchema = z.object({
  client_name: z.string().min(2, 'Nome obrigatório').max(200).optional(),
  client_phone: z
    .string()
    .min(8, 'Telefone inválido')
    .max(30)
    .transform((v) => v.replace(/\D/g, ''))
    .optional(),
  template_type: z.string().min(1).max(100).optional(),
  status: z.enum(['pendente', 'assinado', 'executado', 'cancelado']).optional(),
  signed_by: z.string().optional(),
  signed_date: z.string().optional(),
})

type EditFormValues = z.infer<typeof editSchema>

function EditContractForm({
  contract,
  onSubmit,
}: {
  contract: ContractOut
  onSubmit: (v: EditFormValues) => Promise<void>
}) {
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      client_name: contract.client_name ?? '',
      client_phone: contract.client_phone ?? '',
      template_type: contract.template_type,
      status: contract.status,
      signed_by: contract.signed_by ?? '',
      signed_date: contract.signed_date
        ? new Date(contract.signed_date).toISOString().split('T')[0]
        : '',
    },
  })

  const { isSubmitting } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="client_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Signatário</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Nome completo" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="client_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="(11) 99999-9999" className="pl-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="template_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Contrato</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Casamento — Padrão">Casamento — Padrão</SelectItem>
                  <SelectItem value="Casamento — Premium">Casamento — Premium</SelectItem>
                  <SelectItem value="Corporativo — Padrão">Corporativo — Padrão</SelectItem>
                  <SelectItem value="Debutante — Padrão">Debutante — Padrão</SelectItem>
                  <SelectItem value="Aniversário — Padrão">Aniversário — Padrão</SelectItem>
                  <SelectItem value="Religioso — Padrão">Religioso — Padrão</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {STATUS_OPTIONS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="signed_by"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assinado Por</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do signatário confirmado" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="signed_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data da Assinatura</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// ─── Página principal ──────────────────────────────────────────────────────
export function ContractsPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachingId, setAttachingId] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editContract, setEditContract] = useState<ContractOut | null>(null)
  const [deleteContract, setDeleteContract] = useState<ContractOut | null>(null)

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts', statusFilter],
    queryFn: () =>
      contractsApi.list({ status: (statusFilter as ContractStatus) || undefined, limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (!contracts) return []
    const q = search.toLowerCase().trim()
    if (!q) return contracts
    return contracts.filter((c) =>
      (c.client_name ?? '').toLowerCase().includes(q) ||
      (c.client_phone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, '')) ||
      (c.event_title ?? '').toLowerCase().includes(q) ||
      c.template_type.toLowerCase().includes(q)
    )
  }, [contracts, search])

  useEffect(() => { setPage(1) }, [search, statusFilter])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async ({ body, pdf }: { body: ContractCreate; pdf: File | null }) => {
      const contract = await contractsApi.create(body)
      if (pdf) {
        return contractsApi.attachPdf(contract.id, pdf)
      }
      return contract
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Contrato criado com sucesso!')
      setCreateOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ContractUpdate }) =>
      contractsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Contrato atualizado!')
      setEditContract(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Contrato excluído!')
      setDeleteContract(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => contractsApi.send(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('Contrato enviado para assinatura via ZapSign!')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const attachMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      contractsApi.attachPdf(id, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('PDF anexado com sucesso!')
      setAttachingId(null)
    },
    onError: (err: Error) => {
      toast.error(err.message)
      setAttachingId(null)
    },
  })

  const removePdfMutation = useMutation({
    mutationFn: (id: string) => contractsApi.removePdf(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contracts'] })
      toast.success('PDF removido.')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Handler: upload de PDF na tabela ──────────────────────────────────────
  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !attachingId) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Selecione um arquivo PDF.')
      return
    }
    attachMutation.mutate({ id: attachingId, file })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function triggerAttach(contractId: string) {
    setAttachingId(contractId)
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  return (
    <div className="space-y-6">
      {/* Input oculto para upload de PDF */}
      <input
        type="file"
        accept="application/pdf,.pdf"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Contratos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie contratos e assinaturas digitais via ZapSign
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Contrato
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou evento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-80"
          />
        </div>
        <Select
          value={statusFilter || 'all'}
          onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-center">PDF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">ZapSign</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {search
                    ? 'Nenhum contrato encontrado para esta busca.'
                    : 'Nenhum contrato cadastrado ainda.'}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((contract) => (
                <TableRow key={contract.id}>
                  {/* Nome */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {contract.client_name ?? (
                        <span className="text-muted-foreground italic text-xs">Não informado</span>
                      )}
                    </div>
                  </TableCell>
                  {/* Telefone */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {fmtPhone(contract.client_phone)}
                    </div>
                  </TableCell>
                  {/* Evento */}
                  <TableCell className="max-w-[160px]">
                    <span className="text-sm truncate block">
                      {contract.event_title ?? (
                        <span className="text-muted-foreground font-mono text-xs">
                          {String(contract.event_id).slice(0, 8)}…
                        </span>
                      )}
                    </span>
                  </TableCell>
                  {/* Tipo */}
                  <TableCell className="text-sm">{contract.template_type}</TableCell>
                  {/* PDF */}
                  <TableCell className="text-center">
                    {contract.has_pdf ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600"
                          title="Visualizar / Baixar PDF"
                          onClick={async () => {
                            try {
                              await contractsApi.openPdf(contract.id)
                            } catch (err) {
                              toast.error((err as Error).message)
                            }
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          title="Remover PDF"
                          disabled={removePdfMutation.isPending}
                          onClick={() => removePdfMutation.mutate(contract.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-amber-500"
                        title="Anexar PDF"
                        disabled={attachMutation.isPending && attachingId === contract.id}
                        onClick={() => triggerAttach(contract.id)}
                      >
                        {attachMutation.isPending && attachingId === contract.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Paperclip className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                  {/* Status */}
                  <TableCell>
                    <Badge variant={STATUS_BADGE[contract.status]}>
                      {STATUS_OPTIONS.find((s) => s.value === contract.status)?.label ?? contract.status}
                    </Badge>
                  </TableCell>
                  {/* ZapSign */}
                  <TableCell className="text-center">
                    {contract.zapsign_id ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" title={`ID: ${contract.zapsign_id}`} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  {/* Ações */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Enviar via ZapSign */}
                      {!contract.zapsign_id && contract.status === 'pendente' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          disabled={sendMutation.isPending || !contract.has_pdf}
                          title={!contract.has_pdf ? 'Anexe um PDF antes de enviar' : 'Enviar para assinatura'}
                          onClick={() => sendMutation.mutate(contract.id)}
                        >
                          {sendMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Enviar
                        </Button>
                      )}
                      {/* Editar */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditContract(contract)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {/* Excluir */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteContract(contract)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>

      {/* Modal: Criar */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Novo Contrato</DialogTitle>
          </DialogHeader>
          <CreateContractForm
            onSubmit={async (v, pdf) => {
              await createMutation.mutateAsync({
                body: {
                  event_id: v.event_id,
                  template_type: v.template_type,
                  client_name: v.client_name,
                  client_phone: v.client_phone,
                },
                pdf,
              })
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal: Editar */}
      <Dialog open={!!editContract} onOpenChange={(open) => !open && setEditContract(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar Contrato</DialogTitle>
          </DialogHeader>
          {editContract && (
            <EditContractForm
              contract={editContract}
              onSubmit={async (v) => {
                await updateMutation.mutateAsync({
                  id: editContract.id,
                  body: {
                    client_name: v.client_name?.trim() || undefined,
                    client_phone: v.client_phone?.trim() || undefined,
                    template_type: v.template_type?.trim() || undefined,
                    status: v.status,
                    signed_by: v.signed_by?.trim() || undefined,
                    signed_date: v.signed_date?.trim() || undefined,
                  },
                })
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar exclusão */}
      <AlertDialog
        open={!!deleteContract}
        onOpenChange={(open) => !open && setDeleteContract(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contrato de{' '}
              <strong>{deleteContract?.client_name ?? deleteContract?.template_type}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteContract && deleteMutation.mutate(deleteContract.id)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
