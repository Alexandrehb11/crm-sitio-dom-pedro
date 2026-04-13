import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Zap, CheckCircle2, Search } from 'lucide-react'
import { paymentsApi, eventsApi } from '@/lib/api'
import { DateInput } from '@/components/ui/DateInput'
import type { PaymentOut, PaymentCreate, PaymentUpdate, PaymentStatus, PaymentMethod } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PAGE_SIZE = 10

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cartao', label: 'Cartão de Crédito' },
]

const STATUS_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'pago', label: 'Pago' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'falhou', label: 'Falhou' },
  { value: 'cancelado', label: 'Cancelado' },
]

const METHOD_BADGE: Record<PaymentMethod, 'green' | 'amber' | 'violet'> = {
  pix: 'green',
  boleto: 'amber',
  cartao: 'violet',
}

const STATUS_BADGE: Record<PaymentStatus, 'amber' | 'green' | 'coral' | 'destructive' | 'muted'> = {
  pendente: 'amber',
  pago: 'green',
  vencido: 'coral',
  falhou: 'coral',
  cancelado: 'muted',
}

// --- Create form ---
const createSchema = z.object({
  event_id: z.string().min(1, 'Selecione um evento'),
  amount: z.string().min(1, 'Valor obrigatório'),
  due_date: z.string().min(1, 'Vencimento obrigatório'),
  method: z.enum(['pix', 'boleto', 'cartao']),
  installment_number: z.string().optional(),
  installment_total: z.string().optional(),
})

type CreateFormValues = z.infer<typeof createSchema>

function CreatePaymentForm({ onSubmit }: { onSubmit: (v: CreateFormValues) => Promise<void> }) {
  const { data: events } = useQuery({ queryKey: ['events', ''], queryFn: () => eventsApi.list({ limit: 200 }) })
  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { event_id: '', amount: '', due_date: '', method: 'pix', installment_number: '1', installment_total: '1' },
  })
  const { isSubmitting } = form.formState
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="event_id" render={({ field }) => (
          <FormItem>
            <FormLabel>Evento *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Selecione um evento" /></SelectTrigger></FormControl>
              <SelectContent>{events?.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$) *</FormLabel>
              <FormControl><Input type="number" min="0.01" step="0.01" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="due_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Vencimento *</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={(iso) => field.onChange(iso ?? '')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <FormField control={form.control} name="method" render={({ field }) => (
          <FormItem>
            <FormLabel>Método *</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{METHOD_OPTIONS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="installment_number" render={({ field }) => (
            <FormItem>
              <FormLabel>Parcela Nº</FormLabel>
              <FormControl><Input type="number" min="1" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="installment_total" render={({ field }) => (
            <FormItem>
              <FormLabel>Total de Parcelas</FormLabel>
              <FormControl><Input type="number" min="1" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

// --- Edit form ---
const editSchema = z.object({
  amount: z.string().optional(),
  due_date: z.string().optional(),
  method: z.enum(['pix', 'boleto', 'cartao']).optional(),
  status: z.enum(['pendente', 'pago', 'vencido', 'falhou', 'cancelado']).optional(),
})

type EditFormValues = z.infer<typeof editSchema>

function EditPaymentForm({ payment, onSubmit }: { payment: PaymentOut; onSubmit: (v: EditFormValues) => Promise<void> }) {
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      amount: String(payment.amount),
      due_date: payment.due_date,
      method: payment.method,
      status: payment.status,
    },
  })
  const { isSubmitting } = form.formState
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="amount" render={({ field }) => (
            <FormItem>
              <FormLabel>Valor (R$)</FormLabel>
              <FormControl><Input type="number" min="0.01" step="0.01" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="due_date" render={({ field }) => (
            <FormItem>
              <FormLabel>Vencimento</FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={(iso) => field.onChange(iso ?? '')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="method" render={({ field }) => (
            <FormItem>
              <FormLabel>Método</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{METHOD_OPTIONS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{STATUS_OPTIONS.map(({ value, label }) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )} />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

export function PaymentsPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editPayment, setEditPayment] = useState<PaymentOut | null>(null)
  const [deletePayment, setDeletePayment] = useState<PaymentOut | null>(null)

  const { data: payments, isLoading } = useQuery({
    queryKey: ['payments', statusFilter],
    queryFn: () => paymentsApi.list({ status: (statusFilter as PaymentStatus) || undefined, limit: 200 }),
  })

  const filtered = useMemo(() => {
    if (!payments) return []
    const q = search.toLowerCase().trim()
    if (!q) return payments
    return payments.filter(p =>
      METHOD_OPTIONS.find(m => m.value === p.method)?.label.toLowerCase().includes(q) ||
      STATUS_OPTIONS.find(s => s.value === p.status)?.label.toLowerCase().includes(q) ||
      formatCurrency(p.amount).includes(q)
    )
  }, [payments, search])

  useEffect(() => { setPage(1) }, [search, statusFilter])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const createMutation = useMutation({
    mutationFn: (body: PaymentCreate) => paymentsApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Pagamento criado!'); setCreateOpen(false) },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: PaymentUpdate }) => paymentsApi.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Pagamento atualizado!'); setEditPayment(null) },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Pagamento excluído!'); setDeletePayment(null) },
    onError: (err: Error) => toast.error(err.message),
  })

  const chargeMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.charge(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Cobrança gerada no Asaas!') },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-semibold">Pagamentos</h1>
          <p className="text-muted-foreground mt-1">Gerencie cobranças e parcelas</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Novo Pagamento
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por método, status ou valor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 w-72"
          />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-52">
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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Parcela</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Asaas</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  {search ? 'Nenhum pagamento encontrado para esta busca.' : 'Nenhum pagamento encontrado.'}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(payment => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{payment.lead_name ?? '—'}</span>
                      <span className="font-mono text-xs text-muted-foreground">{payment.lead_phone ?? payment.event_id.slice(0, 8) + '…'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{payment.installment_number}/{payment.installment_total}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell>{formatDate(payment.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant={METHOD_BADGE[payment.method]}>
                      {METHOD_OPTIONS.find(m => m.value === payment.method)?.label ?? payment.method}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[payment.status]}>
                      {STATUS_OPTIONS.find(s => s.value === payment.status)?.label ?? payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment.asaas_id ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {payment.status === 'pendente' && !payment.asaas_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          disabled={chargeMutation.isPending}
                          onClick={() => chargeMutation.mutate(payment.id)}
                        >
                          <Zap className="h-3 w-3" /> Cobrar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => setEditPayment(payment)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletePayment(payment)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Novo Pagamento</DialogTitle></DialogHeader>
          <CreatePaymentForm onSubmit={async (v) => {
            await createMutation.mutateAsync({
              event_id: v.event_id,
              amount: parseFloat(v.amount),
              due_date: v.due_date,
              method: v.method,
              installment_number: v.installment_number ? parseInt(v.installment_number) : 1,
              installment_total: v.installment_total ? parseInt(v.installment_total) : 1,
            })
          }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editPayment} onOpenChange={open => !open && setEditPayment(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Editar Pagamento</DialogTitle></DialogHeader>
          {editPayment && (
            <EditPaymentForm payment={editPayment} onSubmit={async (v) => {
              await updateMutation.mutateAsync({
                id: editPayment.id,
                body: {
                  amount: v.amount ? parseFloat(v.amount) : undefined,
                  due_date: v.due_date || undefined,
                  method: v.method,
                  status: v.status,
                },
              })
            }} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePayment} onOpenChange={open => !open && setDeletePayment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pagamento de <strong>{deletePayment && formatCurrency(deletePayment.amount)}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletePayment && deleteMutation.mutate(deletePayment.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
