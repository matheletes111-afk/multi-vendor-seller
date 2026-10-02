"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Shield,
  ShieldCheck,
  Users,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  Lock,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ExternalLink,
  Layers,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Badge } from "@/ui/badge"
import { Textarea } from "@/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { BACKOFFICE_MODULES, getModulesByCategory } from "@/lib/permissions"
import { PageLoader } from "@/components/ui/page-loader"
import { CountryCodeSelect } from "@/ui/country-code-select"

interface RoleItem {
  id: string
  name: string
  description: string | null
  permissions: string[]
  isActive: boolean
  createdAt: string
  _count?: { users: number }
}

interface StaffItem {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  phoneCountryCode?: string | null
  isBackofficeUser: boolean
  backofficeRoleId: string | null
  backofficeRole: {
    id: string
    name: string
    permissions: string[]
  } | null
  createdAt: string
}

export function RolesClient() {
  const [activeTab, setActiveTab] = useState<"roles" | "staff">("roles")
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [staffUsers, setStaffUsers] = useState<StaffItem[]>([])
  const [searchStaff, setSearchStaff] = useState("")

  // Global feedback message
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // ── Role Create/Edit Modal State ──
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null)
  const [roleName, setRoleName] = useState("")
  const [roleDesc, setRoleDesc] = useState("")
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set())
  const [isSubmittingRole, setIsSubmittingRole] = useState(false)

  // ── Delete Role Dialog State ──
  const [roleToDelete, setRoleToDelete] = useState<RoleItem | null>(null)
  const [isDeletingRole, setIsDeletingRole] = useState(false)

  // ── Add Staff Modal State ──
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false)
  const [staffName, setStaffName] = useState("")
  const [staffEmail, setStaffEmail] = useState("")
  const [staffPhone, setStaffPhone] = useState("")
  const [staffCountryCode, setStaffCountryCode] = useState("+232")
  const [staffRoleId, setStaffRoleId] = useState("")
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false)

  // ── Edit Staff Modal State ──
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null)
  const [editStaffName, setEditStaffName] = useState("")
  const [editStaffPhone, setEditStaffPhone] = useState("")
  const [editStaffCountryCode, setEditStaffCountryCode] = useState("+232")
  const [editStaffRoleId, setEditStaffRoleId] = useState("")
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false)
  const [isResettingStaffPass, setIsResettingStaffPass] = useState(false)

  // ── One-Time Credential Copy Dialog State ──
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string
    email: string
    password: string
    loginUrl: string
    roleName: string
    emailDispatched: boolean
  } | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  // ── Delete Staff Dialog State ──
  const [staffToDelete, setStaffToDelete] = useState<StaffItem | null>(null)
  const [isDeletingStaff, setIsDeletingStaff] = useState(false)

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [rolesRes, staffRes] = await Promise.all([
        fetch("/api/admin/roles"),
        fetch("/api/admin/backoffice-users"),
      ])

      const rolesJson = await rolesRes.json()
      const staffJson = await staffRes.json()

      if (rolesRes.ok && rolesJson.roles) {
        setRoles(rolesJson.roles)
      }
      if (staffRes.ok && staffJson.users) {
        setStaffUsers(staffJson.users)
      }
    } catch (err: any) {
      console.error("Failed to fetch roles & staff data:", err)
      setFeedback({ type: "error", text: "Failed to load roles and staff data." })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─────────────────────────────────────────────────────────────
  // ROLE ACTIONS
  // ─────────────────────────────────────────────────────────────
  const handleOpenCreateRole = () => {
    setEditingRole(null)
    setRoleName("")
    setRoleDesc("")
    setSelectedPermissions(new Set())
    setIsRoleModalOpen(true)
  }

  const handleOpenEditRole = (role: RoleItem) => {
    setEditingRole(role)
    setRoleName(role.name)
    setRoleDesc(role.description || "")
    const perms = Array.isArray(role.permissions)
      ? role.permissions
      : typeof role.permissions === "string"
      ? JSON.parse(role.permissions || "[]")
      : []
    setSelectedPermissions(new Set(perms))
    setIsRoleModalOpen(true)
  }

  const handleTogglePermission = (key: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSelectAllCategory = (keys: string[]) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      const allSelected = keys.every((k) => next.has(k))
      if (allSelected) {
        keys.forEach((k) => next.delete(k))
      } else {
        keys.forEach((k) => next.add(k))
      }
      return next
    })
  }

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      setFeedback({ type: "error", text: "Please enter a role title." })
      return
    }

    setIsSubmittingRole(true)
    setFeedback(null)
    try {
      const payload = {
        name: roleName.trim(),
        description: roleDesc.trim(),
        permissions: Array.from(selectedPermissions),
      }

      const url = editingRole ? `/api/admin/roles/${editingRole.id}` : "/api/admin/roles"
      const method = editingRole ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to save role.")
      }

      setFeedback({
        type: "success",
        text: editingRole
          ? `Role "${json.role.name}" updated successfully.`
          : `New role "${json.role.name}" created successfully.`,
      })
      setIsRoleModalOpen(false)
      fetchData()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to save role." })
    } finally {
      setIsSubmittingRole(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!roleToDelete) return
    setIsDeletingRole(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/roles/${roleToDelete.id}`, { method: "DELETE" })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to delete role.")
      }

      setFeedback({ type: "success", text: json.message || "Role deleted successfully." })
      setRoleToDelete(null)
      fetchData()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to delete role." })
    } finally {
      setIsDeletingRole(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // STAFF ACTIONS
  // ─────────────────────────────────────────────────────────────
  const handleOpenAddStaff = () => {
    setStaffName("")
    setStaffEmail("")
    setStaffPhone("")
    setStaffCountryCode("+232")
    setStaffRoleId(roles[0]?.id || "")
    setIsStaffModalOpen(true)
  }

  const handleSaveStaff = async () => {
    if (!staffName.trim()) {
      setFeedback({ type: "error", text: "Staff name is required." })
      return
    }
    if (!staffEmail.trim() || !staffEmail.includes("@")) {
      setFeedback({ type: "error", text: "Valid email address is required." })
      return
    }
    if (!staffRoleId) {
      setFeedback({ type: "error", text: "Please assign a role to this staff member." })
      return
    }

    setIsSubmittingStaff(true)
    setFeedback(null)
    try {
      const payload = {
        name: staffName.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim() || undefined,
        phoneCountryCode: staffPhone.trim() ? staffCountryCode : undefined,
        roleId: staffRoleId,
      }

      const res = await fetch("/api/admin/backoffice-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to create backoffice staff.")
      }

      setIsStaffModalOpen(false)
      const selectedRoleObj = roles.find((r) => r.id === staffRoleId)

      // Open fail-safe copy dialog
      setCreatedCredentials({
        name: json.user.name || staffName.trim(),
        email: json.user.email,
        password: json.generatedPassword,
        loginUrl: `${window.location.origin}/backoffice/login`,
        roleName: selectedRoleObj?.name || "Staff",
        emailDispatched: json.emailDispatched,
      })

      fetchData()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to create staff member." })
    } finally {
      setIsSubmittingStaff(false)
    }
  }

  const handleOpenEditStaff = (staff: StaffItem) => {
    setEditingStaff(staff)
    setEditStaffName(staff.name || "")
    setEditStaffPhone(staff.phone || "")
    setEditStaffCountryCode(staff.phoneCountryCode || "+232")
    setEditStaffRoleId(staff.backofficeRoleId || "")
  }

  const handleUpdateStaff = async () => {
    if (!editingStaff) return
    if (!editStaffName.trim()) {
      setFeedback({ type: "error", text: "Staff name is required." })
      return
    }
    if (!editStaffRoleId) {
      setFeedback({ type: "error", text: "Please assign a role to this staff member." })
      return
    }

    setIsUpdatingStaff(true)
    setFeedback(null)
    try {
      const payload = {
        name: editStaffName.trim(),
        phone: editStaffPhone.trim() || null,
        phoneCountryCode: editStaffPhone.trim() ? editStaffCountryCode : null,
        roleId: editStaffRoleId,
      }

      const res = await fetch(`/api/admin/backoffice-users/${editingStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to update staff member.")
      }

      setFeedback({ type: "success", text: json.message || "Staff member updated successfully." })
      setEditingStaff(null)
      fetchData()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to update staff." })
    } finally {
      setIsUpdatingStaff(false)
    }
  }

  const handleAdminResetStaffPassword = async () => {
    if (!editingStaff) return
    setIsResettingStaffPass(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/backoffice-users/${editingStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resetPassword: true }),
      })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to reset password.")
      }

      const selectedRoleObj = roles.find((r) => r.id === (editingStaff.backofficeRoleId || editStaffRoleId))

      setCreatedCredentials({
        name: editingStaff.name || "Staff Member",
        email: editingStaff.email || "",
        password: json.generatedPassword,
        loginUrl: `${window.location.origin}/backoffice/login`,
        roleName: selectedRoleObj?.name || "Staff",
        emailDispatched: json.emailDispatched,
      })

      setEditingStaff(null)
      setFeedback({
        type: "success",
        text: json.emailDispatched
          ? "New credentials generated and emailed to staff."
          : "New credentials generated. Please copy and provide them to staff.",
      })
      fetchData()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to reset staff password." })
    } finally {
      setIsResettingStaffPass(false)
    }
  }

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return
    setIsDeletingStaff(true)
    setFeedback(null)
    try {
      const res = await fetch(`/api/admin/backoffice-users/${staffToDelete.id}`, { method: "DELETE" })
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || "Failed to remove staff member.")
      }

      setFeedback({ type: "success", text: json.message || "Staff member removed successfully." })
      setStaffToDelete(null)
      fetchData()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to delete staff member." })
    } finally {
      setIsDeletingStaff(false)
    }
  }

  const handleCopyCredentials = () => {
    if (!createdCredentials) return
    const textToCopy = `Meeem Backoffice Credentials:\nPortal: ${createdCredentials.loginUrl}\nEmail: ${createdCredentials.email}\nPassword: ${createdCredentials.password}\nRole: ${createdCredentials.roleName}`
    navigator.clipboard.writeText(textToCopy)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 3000)
  }

  const filteredStaff = staffUsers.filter((u) => {
    const term = searchStaff.toLowerCase().trim()
    if (!term) return true
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.includes(term)) ||
      (u.backofficeRole?.name && u.backofficeRole.name.toLowerCase().includes(term))
    )
  })

  const moduleCategories = getModulesByCategory()

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <PageLoader message="Loading Roles & Staff permissions..." />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500 max-w-7xl">
      {/* ── HEADER BANNER ── */}
      <div className="rounded-3xl border border-blue-900/20 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Roles & Backoffice Staff</h1>
          </div>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Configure dynamic administrative roles, toggle individual sidebar module permissions, and provision backoffice staff members with auto-generated credentials.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {activeTab === "roles" ? (
            <Button
              onClick={handleOpenCreateRole}
              className="rounded-2xl px-5 h-11 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Role</span>
            </Button>
          ) : (
            <Button
              onClick={handleOpenAddStaff}
              className="rounded-2xl px-5 h-11 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Staff Member</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── FEEDBACK ALERT ── */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-sm font-medium animate-in fade-in duration-300 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              : "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs uppercase font-bold hover:underline opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── TABS ── */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 inline-flex">
          <TabsTrigger
            value="roles"
            className="rounded-xl px-5 py-2.5 font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm flex items-center gap-2"
          >
            <Shield className="h-4 w-4 text-blue-600" />
            <span>Roles & Permissions ({roles.length})</span>
          </TabsTrigger>
          <TabsTrigger
            value="staff"
            className="rounded-xl px-5 py-2.5 font-bold text-xs uppercase tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm flex items-center gap-2"
          >
            <Users className="h-4 w-4 text-emerald-600" />
            <span>Staff Directory ({staffUsers.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: ROLES MANAGEMENT
           ───────────────────────────────────────────────────────────── */}
        <TabsContent value="roles" className="space-y-6 outline-none">
          {roles.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-2 p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Shield className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No Custom Roles Configured</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Get started by creating your first backoffice role. You can select exactly which sidebar modules are visible and accessible.
              </p>
              <Button onClick={handleOpenCreateRole} className="rounded-2xl font-bold bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Role
              </Button>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => {
                const perms = Array.isArray(role.permissions)
                  ? role.permissions
                  : typeof role.permissions === "string"
                  ? JSON.parse(role.permissions || "[]")
                  : []

                return (
                  <Card
                    key={role.id}
                    className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                  >
                    <CardHeader className="pb-4 border-b border-muted/20 bg-muted/5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <CardTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                            <span>{role.name}</span>
                          </CardTitle>
                          <CardDescription className="text-xs line-clamp-2">
                            {role.description || "No description provided."}
                          </CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full px-3 py-1 font-bold text-[10px] uppercase bg-blue-50 text-blue-700 border-blue-200 shrink-0"
                        >
                          {role._count?.users ?? 0} Staff
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4 flex-1 space-y-4">
                      <div>
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                          Permitted Modules ({perms.length}/{BACKOFFICE_MODULES.length})
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {perms.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">No modules assigned</span>
                          ) : (
                            perms.map((pKey: string) => {
                              const mod = BACKOFFICE_MODULES.find((m) => m.key === pKey)
                              return (
                                <Badge
                                  key={pKey}
                                  variant="secondary"
                                  className="text-[10px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                >
                                  {mod?.label || pKey}
                                </Badge>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </CardContent>

                    <div className="p-4 border-t border-muted/20 bg-muted/10 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditRole(role)}
                        className="rounded-xl text-xs font-bold border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 flex-1"
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                        Edit Permissions
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRoleToDelete(role)}
                        className="rounded-xl text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 px-3"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: STAFF USERS DIRECTORY
           ───────────────────────────────────────────────────────────── */}
        <TabsContent value="staff" className="space-y-6 outline-none">
          <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <CardHeader className="p-5 border-b border-muted/20 bg-muted/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search staff by name, email, or role..."
                  value={searchStaff}
                  onChange={(e) => setSearchStaff(e.target.value)}
                  className="pl-9 rounded-2xl h-10 text-xs bg-background"
                />
              </div>

              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-full px-4 py-1.5 text-xs font-bold text-muted-foreground">
                  {filteredStaff.length} Members Listed
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10">
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Staff Member</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Assigned Role</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Phone</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Permitted Scope</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider">Created</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStaff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                        No backoffice staff found matching your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStaff.map((staff) => {
                      const perms = Array.isArray(staff.backofficeRole?.permissions)
                        ? staff.backofficeRole.permissions
                        : []

                      return (
                        <TableRow key={staff.id} className="hover:bg-muted/5">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                                {(staff.name || staff.email || "S")[0].toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-sm block text-foreground">{staff.name || "Unnamed Staff"}</span>
                                <span className="text-xs text-muted-foreground block">{staff.email}</span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge className="font-bold text-xs rounded-xl bg-blue-100 text-blue-800 border-none dark:bg-blue-900/40 dark:text-blue-200">
                              <ShieldCheck className="h-3 w-3 mr-1 text-blue-600" />
                              {staff.backofficeRole?.name || "Unassigned"}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {staff.phone ? (
                              <span>
                                {staff.phoneCountryCode ? `${staff.phoneCountryCode} ` : ""}{staff.phone}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>

                          <TableCell>
                            <span className="text-xs font-semibold text-foreground">
                              {perms.length} modules granted
                            </span>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(staff.createdAt).toLocaleDateString()}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditStaff(staff)}
                                className="rounded-xl text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              >
                                <Edit2 className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStaffToDelete(staff)}
                                className="rounded-xl text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─────────────────────────────────────────────────────────────
          ROLE CREATE / EDIT MODAL
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <span>{editingRole ? `Edit Role: ${editingRole.name}` : "Create New Backoffice Role"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure the role title, summary description, and select the permitted admin sidebar modules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="roleName" className="text-xs font-bold uppercase tracking-wider">
                  Role Name *
                </Label>
                <Input
                  id="roleName"
                  placeholder="e.g. Catalog Specialist, Orders Dispatcher"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="rounded-xl h-11 text-sm font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleDesc" className="text-xs font-bold uppercase tracking-wider">
                  Description
                </Label>
                <Input
                  id="roleDesc"
                  placeholder="Short explanation of staff duties"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  className="rounded-xl h-11 text-sm"
                />
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <h4 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span>Sidebar Module Permissions</span>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permitted modules give access to the page and all sub-routes (creates, edits, views).
                  </p>
                </div>
                <Badge variant="outline" className="font-bold text-xs rounded-full px-3 py-1">
                  {selectedPermissions.size} / {BACKOFFICE_MODULES.length} Selected
                </Badge>
              </div>

              {Object.entries(moduleCategories).map(([category, modules]) => {
                const categoryKeys = modules.map((m) => m.key)
                const isAllSelected = categoryKeys.every((k) => selectedPermissions.has(k))

                return (
                  <div key={category} className="space-y-3 rounded-2xl border p-4 bg-muted/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-foreground uppercase tracking-wider">
                        {category} ({modules.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSelectAllCategory(categoryKeys)}
                        className="text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        {isAllSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {modules.map((mod) => {
                        const checked = selectedPermissions.has(mod.key)
                        return (
                          <div
                            key={mod.key}
                            onClick={() => handleTogglePermission(mod.key)}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-3 select-none ${
                              checked
                                ? "bg-blue-50 border-blue-300 dark:bg-blue-950/40 dark:border-blue-700 shadow-sm"
                                : "bg-card border-slate-200 dark:border-slate-800 hover:border-slate-300 opacity-70 hover:opacity-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="mt-0.5 h-4 w-4 rounded text-blue-600 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                              <span className="text-xs font-bold block text-foreground leading-tight">
                                {mod.label}
                              </span>
                              <span className="text-[10px] text-muted-foreground block line-clamp-1">
                                {mod.description}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsRoleModalOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveRole}
              disabled={isSubmittingRole}
              className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {isSubmittingRole ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          ADD STAFF MODAL
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <span>Add Backoffice Staff</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              A cryptographically secure password will be auto-generated and dispatched directly to the staff member's email address along with the portal login URL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Full Name *</Label>
              <Input
                placeholder="e.g. John Doe"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                className="rounded-xl h-11 text-sm font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Official Email *</Label>
              <Input
                type="email"
                placeholder="john.doe@meeemsl.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                className="rounded-xl h-11 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Mobile Number (Optional)</Label>
              <div className="grid grid-cols-[115px_1fr] gap-2">
                <CountryCodeSelect
                  value={staffCountryCode}
                  onChange={(code) => setStaffCountryCode(code)}
                  className="h-11 rounded-xl text-xs bg-background border-slate-200 dark:border-slate-800"
                />
                <Input
                  type="tel"
                  placeholder="76 123456"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  className="rounded-xl h-11 text-sm font-medium"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Country code stored in DB and used for SMS OTP authentication.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider">Assigned Role *</Label>
              <Select value={staffRoleId || undefined} onValueChange={setStaffRoleId}>
                <SelectTrigger className="rounded-xl h-11 text-sm font-semibold">
                  <SelectValue placeholder="Select an administrative role" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id} className="font-semibold text-xs py-2.5">
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-start gap-3">
              <KeyRound className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                Credentials (Username, Auto Password, and Login URL) will be emailed immediately via SendGrid upon creation.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsStaffModalOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveStaff}
              disabled={isSubmittingStaff}
              className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px]"
            >
              {isSubmittingStaff ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Provision Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          ONE-TIME CREDENTIALS COPY DIALOG (FAIL-SAFE UX)
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!createdCredentials} onOpenChange={(open) => !open && setCreatedCredentials(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <span>Staff Provisioned Successfully</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {createdCredentials?.emailDispatched
                ? "An email with these credentials has been sent via SendGrid. You can also copy them below."
                : "Automated email could not be sent. Please copy these credentials and share them with the staff member."}
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                    Login Portal URL
                  </span>
                  <span className="font-bold text-blue-600 break-all">{createdCredentials.loginUrl}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                    Staff Email
                  </span>
                  <span className="font-bold text-foreground">{createdCredentials.email}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                    Temporary Password
                  </span>
                  <span className="font-bold text-emerald-600 text-sm">{createdCredentials.password}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-sans font-bold block">
                    Assigned Role
                  </span>
                  <span className="font-bold text-foreground font-sans">{createdCredentials.roleName}</span>
                </div>
              </div>

              <Button
                onClick={handleCopyCredentials}
                className="w-full rounded-2xl font-bold h-11 bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2"
              >
                {hasCopied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                <span>{hasCopied ? "Copied to Clipboard!" : "Copy All Credentials"}</span>
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatedCredentials(null)}
              className="w-full rounded-xl font-bold"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          EDIT STAFF MODAL
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
        <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Edit Staff Member</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update staff profile, assigned role, mobile number, or trigger an administrative password reset.
            </DialogDescription>
          </DialogHeader>

          {editingStaff && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Staff Full Name *</Label>
                <Input
                  placeholder="e.g. John Doe"
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="rounded-xl h-11 text-sm font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Staff Email</Label>
                <Input
                  disabled
                  value={editingStaff.email || ""}
                  className="rounded-xl h-11 text-sm bg-muted/50 cursor-not-allowed opacity-80"
                />
                <p className="text-[10px] text-muted-foreground">
                  Email addresses are fixed identifiers and cannot be altered.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Mobile Number (Optional)</Label>
                <div className="grid grid-cols-[115px_1fr] gap-2">
                  <CountryCodeSelect
                    value={editStaffCountryCode}
                    onChange={(code) => setEditStaffCountryCode(code)}
                    className="h-11 rounded-xl text-xs bg-background border-slate-200 dark:border-slate-800"
                  />
                  <Input
                    type="tel"
                    placeholder="76 123456"
                    value={editStaffPhone}
                    onChange={(e) => setEditStaffPhone(e.target.value)}
                    className="rounded-xl h-11 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider">Assigned Role *</Label>
                <Select value={editStaffRoleId || undefined} onValueChange={setEditStaffRoleId}>
                  <SelectTrigger className="rounded-xl h-11 text-sm font-semibold">
                    <SelectValue placeholder="Select an administrative role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id} className="font-semibold text-xs py-2.5">
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Password Reset Action */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200 block">
                    Password Reset
                  </span>
                  <span className="text-[11px] text-amber-700 dark:text-amber-300 block">
                    Generate a new password and email it to staff.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAdminResetStaffPassword}
                  disabled={isResettingStaffPass || isUpdatingStaff}
                  className="rounded-xl font-bold text-xs bg-white dark:bg-slate-900 border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 shrink-0"
                >
                  {isResettingStaffPass ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Reset & Email"}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditingStaff(null)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStaff}
              disabled={isUpdatingStaff || isResettingStaffPass}
              className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white min-w-[130px]"
            >
              {isUpdatingStaff ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          DELETE ROLE CONFIRMATION MODAL
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>Delete Role: {roleToDelete?.name}?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete this role? This action cannot be undone. If staff are assigned, deletion will be blocked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setRoleToDelete(null)} className="rounded-xl font-bold">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRole}
              disabled={isDeletingRole}
              className="rounded-xl font-bold min-w-[100px]"
            >
              {isDeletingRole ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────────────────────────────────────────────────────
          DELETE STAFF CONFIRMATION MODAL
         ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!staffToDelete} onOpenChange={(open) => !open && setStaffToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>Remove Staff: {staffToDelete?.name || staffToDelete?.email}?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will revoke backoffice access for this staff member immediately. They will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setStaffToDelete(null)} className="rounded-xl font-bold">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStaff}
              disabled={isDeletingStaff}
              className="rounded-xl font-bold min-w-[100px]"
            >
              {isDeletingStaff ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Remove Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
