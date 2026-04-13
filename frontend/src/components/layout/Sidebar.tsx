import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  FileText,
  Truck,
  LogOut,
  BarChart2,
  Settings,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const mainNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/events', icon: Calendar, label: 'Agenda' },
  { to: '/payments', icon: CreditCard, label: 'Pagamentos' },
  { to: '/contracts', icon: FileText, label: 'Contratos' },
  { to: '/providers', icon: Truck, label: 'Fornecedores' },
]

const bottomNavItems = [
  { to: '/reports', icon: BarChart2, label: 'Relatórios' },
  { to: '/messages', icon: MessageSquare, label: 'Mensagens Auto.' },
]

const adminNavItems = [
  { to: '/users', icon: ShieldCheck, label: 'Usuários' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
]

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <li>
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground/70 hover:bg-accent hover:text-foreground',
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </NavLink>
    </li>
  )
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-card">
      {/* Logo area */}
      <div className="flex h-16 items-center border-b px-6">
        <span className="font-serif text-lg font-semibold text-primary leading-tight">
          Sítio Dom Pedro
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {/* Main items */}
        <ul className="space-y-1">
          {mainNavItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </ul>

        <Separator className="my-3" />

        {/* Bottom items */}
        <ul className="space-y-1">
          {bottomNavItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </ul>

        {/* Admin-only items */}
        {isAdmin && (
          <>
            <Separator className="my-3" />
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Admin
            </p>
            <ul className="space-y-1">
              {adminNavItems.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="border-t p-4 space-y-3">
        {user && (
          <div className="flex items-center gap-2 px-1">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.username}</p>
              <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="mt-0.5 text-xs">
                {user.role === 'admin' ? 'Admin' : 'Vendedor'}
              </Badge>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
