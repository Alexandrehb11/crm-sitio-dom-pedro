import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { leadsApi } from '@/lib/api'
import type { LeadOut, LeadCreate, LeadUpdate, FunnelStageType, EventType, SourceChannel } from '@/types'
import { formatDate } from '@/lib/utils'
import { DateInput } from '@/components/ui/DateInput'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 10

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'casamento', label: 'Casamento' },
  { value: 'corporativo', label: 'Corporativo' },
  { value: 'debutante', label: 'Debutante' },
  { value: 'religioso', label: 'Religioso' },
  { value: 'aniversario', label: 'Aniversário' },
  { value: 'outro', label: 'Outro' },
]

const SOURCE_CHANNELS: { value: SourceChannel; label: string }[] = [
  { value: 'formulario', label: 'Formulário' },
  { value: 'chatbot', label: 'Chatbot' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'qr_code', label: 'QR Code' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'outro', label: 'Outro' },
]

const FUNNEL_STAGES: { value: FunnelStageType; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'visita_agendada', label: 'Visita Agendada' },
  { value: 'proposta_enviada', label: 'Proposta Enviada' },
  { value: 'contrato_assinado', label: 'Contrato Assinado' },
  { value: 'evento_realizado', label: 'Evento Realizado' },
]

const FUNNEL_STAGE_LABELS: Record<FunnelStageType, string> = {
  lead: 'Lead',
  visita_agendada: 'Visita Agendada',
  proposta_enviada: 'Proposta Enviada',
  contrato_assinado: 'Contrato Assinado',
  evento_realizado: 'Evento Realizado',
}

const FUNNEL_STAGE_COLORS: Record<FunnelStageType, 'steel' | 'amber' | 'blue' | 'green' | 'pine'> = {
  lead: 'steel',
  visita_agendada: 'blue',
  proposta_enviada: 'amber',
  contrato_assinado: 'green',
  evento_realizado: 'pine',
}

function scoreBadge(score: number) {
  if (score >= 60) return { variant: 'green' as const, label: `${score} Quente` }
  if (score >= 30) return { variant: 'amber' as const, label: `${score} Morno` }
  return { variant: 'blue' as const, label: `${score} Frio` }
}

const leadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  email: z.string().optional(),
  event_date: z.string().optional(),
  event_date_alt: z.string().optional(),
  event_type: z.enum(['casamento', 'corporativo', 'debutante', 'religioso', 'aniversario', 'outro']),
  guest_count: z.string().optional(),
  budget: z.string().optional(),
  source_channel: z.enum(['formulario', 'chatbot', 'whatsapp', 'qr_code', 'indicacao', 'instagram', 'outro']),
  notes: z.string().optional(),
  consent_lgpd: z.boolean(),
  funnel_stage: z.enum(['lead', 'visita_agendada', 'proposta_enviada', 'contrato_assinado', 'evento_realizado']).optional(),
})

type LeadFormValues = z.infer<typeof leadSchema>

function toLeadCreate(v: LeadFormValues): LeadCreate {
  return {
    name: v.name,
    phone: v.phone,
    email: v.email?.trim() || undefined,
    event_date: v.event_date?.trim() || undefined,
    event_date_alt: v.event_date_alt?.trim() || undefined,
    event_type: v.event_type,
    guest_count: v.guest_count ? parseInt(v.guest_count, 10) : undefined,
    budget: v.budget ? parseFloat(v.budget) : undefined,
    source_channel: v.source_channel,
    notes: v.notes?.trim() || undefined,
    consent_lgpd: v.consent_lgpd,
  }
}

function toLeadUpdate(v: LeadFormValues): LeadUpdate {
  return {
    ...toLeadCreate(v),
    funnel_stage: v.funnel_stage,
  }
}

interface LeadFormProps {
  defaultValues?: Partial<LeadFormValues>
  onSubmit: (values: LeadFormValues) => Promise<void>
  isEdit?: boolean
}

function LeadForm({ defaultValues, onSubmit, isEdit = false }: LeadFormProps) {
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      event_date: '',
      event_date_alt: '',
      event_type: 'casamento',
      guest_count: undefined,
      budget: undefined,
      source_channel: 'formulario',
      notes: '',
      consent_lgpd: false,
      funnel_stage: 'lead',
      ...defaultValues,
    },
  })

  const { isSubmitting } = form.formState

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>Nome *</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem>
              <FormLabel>Telefone *</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>E-mail</FormLabel>
            <FormControl><Input type="email" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="event_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Data do Evento</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={(iso) => field.onChange(iso ?? '')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="event_date_alt" render={({ field }) => (
            <FormItem>
              <FormLabel>Data Alternativa</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={(iso) => field.onChange(iso ?? '')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="event_type" render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Evento *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {EVENT_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="source_channel" render={({ field }) => (
            <FormItem>
              <FormLabel>Canal de Origem *</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {SOURCE_CHANNELS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="guest_count" render={({ field }) => (
            <FormItem>
              <FormLabel>Nº de Convidados</FormLabel>
              <FormControl><Input type="number" min="1" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="budget" render={({ field }) => (
            <FormItem>
              <FormLabel>Orçamento (R$)</FormLabel>
              <FormControl><Input type="number" min="0" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value)} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        {isEdit && (
          <FormField control={form.control} name="funnel_stage" render={({ field }) => (
            <FormItem>
              <FormLabel>Etapa do Funil</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FUNNEL_STAGES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        )}

        <FormField control={form.control} name="notes" render={({ field }) => (
          <FormItem>
            <FormLabel>Observações</FormLabel>
            <FormControl><Textarea rows={3} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="consent_lgpd" render={({ field }) => (
          <FormItem className="flex items-start gap-3 space-y-0 rounded-md border p-4">
            <FormControl>
              <input
                type="checkbox"
                checked={field.value}
                onChange={field.onChange}
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
              />
            </FormControl>
            <div>
              <FormLabel className="cursor-pointer">Consentimento LGPD</FormLabel>
              <p className="text-xs text-muted-foreground mt-1">
                O lead autorizou o uso dos seus dados conforme a LGPD.
              </p>
            </div>
            <FormMessage />
          </FormItem>
        )} />

        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export function LeadsPage() {
  const qc = useQueryClient()
  const [stageFilter, setStageFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editLead, setEditLead] = useState<LeadOut | null>(null)
  const [deleteLead, setDeleteLead] = useState<LeadOut | null>(null)

  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads', stageFilter],
    queryFn: () => leadsApi.list({ stage: stageFilter || undefined, limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (!leads) return []
    const q = search.toLowerCase().trim()
    if (!q) return leads
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.phone.toLowerCase().includes(q) ||
      (l.email ?? '').toLowerCase().includes(q)
    )
  }, [leads, search])

  useEffect(() => { setPage(1) }, [search, stageFilter])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: (body: LeadCreate) => leadsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead criado com sucesso!')
      setCreateOpen(false)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: LeadUpdate }) => leadsApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead atualizado com sucesso!')
      setEditLead(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => leadsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead excluído com sucesso!')
      setDeleteLead(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Leads</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus leads e oportunidades</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Novo Lead
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-72"
          />
        </div>
        <Select value={stageFilter || 'all'} onValueChange={v => setStageFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todas as etapas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {FUNNEL_STAGES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Tipo Evento</TableHead>
              <TableHead>Data Evento</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Funil</TableHead>
              <TableHead>Canal</TableHead>
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
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  {search ? 'Nenhum lead encontrado para esta busca.' : 'Nenhum lead encontrado.'}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((lead) => {
                const score = scoreBadge(lead.score)
                const stageColor = FUNNEL_STAGE_COLORS[lead.funnel_stage]
                const stageLabel = FUNNEL_STAGE_LABELS[lead.funnel_stage]
                const eventTypeLabel = EVENT_TYPES.find(e => e.value === lead.event_type)?.label ?? lead.event_type
                const channelLabel = SOURCE_CHANNELS.find(c => c.value === lead.source_channel)?.label ?? lead.source_channel
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="font-mono text-sm">{lead.phone}</TableCell>
                    <TableCell>{eventTypeLabel}</TableCell>
                    <TableCell>{lead.event_date ? formatDate(lead.event_date) : '-'}</TableCell>
                    <TableCell>
                      <Badge variant={score.variant}>{score.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stageColor}>{stageLabel}</Badge>
                    </TableCell>
                    <TableCell>{channelLabel}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditLead(lead)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteLead(lead)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <LeadForm
            onSubmit={async (values) => {
              await createMutation.mutateAsync(toLeadCreate(values))
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editLead} onOpenChange={(open) => !open && setEditLead(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Lead</DialogTitle>
          </DialogHeader>
          {editLead && (
            <LeadForm
              isEdit
              defaultValues={{
                name: editLead.name,
                phone: editLead.phone,
                email: editLead.email ?? '',
                event_date: editLead.event_date ?? '',
                event_date_alt: editLead.event_date_alt ?? '',
                event_type: editLead.event_type,
                guest_count: editLead.guest_count != null ? String(editLead.guest_count) : '',
                budget: editLead.budget != null ? String(editLead.budget) : '',
                source_channel: editLead.source_channel,
                notes: editLead.notes ?? '',
                consent_lgpd: editLead.consent_lgpd,
                funnel_stage: editLead.funnel_stage,
              }}
              onSubmit={async (values) => {
                await updateMutation.mutateAsync({ id: editLead.id, body: toLeadUpdate(values) })
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLead} onOpenChange={(open) => !open && setDeleteLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{deleteLead?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteLead && deleteMutation.mutate(deleteLead.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
