import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  Users, UserCheck, Calendar, Clock, CheckCircle, XCircle,
  TrendingUp, FileText, Download, RefreshCw, LogOut, Stethoscope,
  ChevronDown, ChevronUp, DollarSign, Activity, CreditCard, Plus, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────────────────────────────────
type Appointment = {
  _id: string;
  status: "pending" | "scheduled" | "cancelled" | "completed";
  startAt: string;
  endAt: string;
  reason?: string;
  notes?: string;
  consultationType?: string;
  amount?: number;
  isPaid?: boolean;
  paymentStatus?: string;
  paymentDetails?: { method?: string; transactionId?: string; email?: string };
  doctor?: { _id: string; firstName: string; lastName: string; email: string; doctorProfile?: { specialty?: string; monthlyAvailability?: unknown[] } };
  patient?: { _id: string; firstName: string; lastName: string; email: string };
};

type Doctor = {
  _id: string; firstName: string; lastName: string; email: string; phone?: string;
  doctorProfile?: { specialty?: string; monthlyAvailability?: { date: string; segments: { start: string; end: string }[] }[] };
};

type Stats = {
  totalPatients: number; totalDoctors: number; totalAppointments: number;
  pendingCount: number; scheduledCount: number; totalRevenue: number;
};

type AdminPaymentAccount = {
  _id: string;
  label: string;
  method: string;
  network?: string;
  bankName?: string;
  accountNumber: string;
  accountName: string;
  isActive: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  scheduled: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GH", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"appointments" | "doctors" | "patients" | "payments">("appointments");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedDoctor, setExpandedDoctor] = useState<string | null>(null);
  const [expandedAppt, setExpandedAppt] = useState<string | null>(null);

  // Guard: only admins
  useEffect(() => {
    if (!user) { navigate("/login", { replace: true }); return; }
    if (user.role !== "admin") { navigate("/", { replace: true }); return; }
  }, [user, navigate]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [apptData, docData, statsData] = await Promise.allSettled([
        api<{ appointments: Appointment[] }>("/api/admin/appointments"),
        api<{ doctors: Doctor[] }>("/api/admin/doctors"),
        api<Stats>("/api/admin/stats"),
      ]);
      if (apptData.status === "fulfilled") setAppointments(apptData.value.appointments);
      if (docData.status === "fulfilled") setDoctors(docData.value.doctors);
      if (statsData.status === "fulfilled") setStats(statsData.value);
    } catch {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      const res = await api<{ ok: boolean; receiptNo: string; previewUrl?: string }>(
        `/api/admin/appointments/${id}/approve`, { method: "PATCH" }
      );
      toast.success(`✅ Approved! Receipt ${res.receiptNo} sent to patient.`);
      if (res.previewUrl) window.open(res.previewUrl, "_blank");
      void fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to approve");
    } finally { setBusyId(null); }
  }

  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await api(`/api/admin/appointments/${id}/reject`, { method: "PATCH" });
      toast.success("Appointment rejected & patient notified.");
      void fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject");
    } finally { setBusyId(null); }
  }

  function downloadMedicalHistory(patientId: string) {
    const base = import.meta.env.VITE_API_URL || "";
    window.open(`${base}/api/admin/patients/${patientId}/medical-history`, "_blank");
  }

  const pending = appointments.filter((a) => a.status === "pending");
  const scheduled = appointments.filter((a) => a.status === "scheduled");
  const allOther = appointments.filter((a) => !["pending", "scheduled"].includes(a.status));

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top Nav ─────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-none">Meddical Admin</p>
              <p className="text-xs text-gray-500">Control Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden sm:block text-sm text-gray-600">
              Welcome, <span className="font-semibold text-gray-900">{user.firstName}</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => void fetchAll()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); navigate("/login"); }}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── Stats Grid ──────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard icon={Users} label="Patients" value={stats.totalPatients} color="bg-blue-50 text-blue-600" />
            <StatCard icon={Stethoscope} label="Doctors" value={stats.totalDoctors} color="bg-indigo-50 text-indigo-600" />
            <StatCard icon={Calendar} label="Total Appts" value={stats.totalAppointments} color="bg-purple-50 text-purple-600" />
            <StatCard icon={Clock} label="Pending" value={stats.pendingCount} color="bg-yellow-50 text-yellow-600" />
            <StatCard icon={UserCheck} label="Scheduled" value={stats.scheduledCount} color="bg-green-50 text-green-600" />
            <StatCard icon={DollarSign} label="Revenue (GHS)" value={stats.totalRevenue.toFixed(0)} color="bg-emerald-50 text-emerald-600" />
          </div>
        )}

        {/* ── Tab Navigation ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1 bg-white rounded-xl p-1 border border-gray-200 w-fit shadow-sm">
          {([
            { key: "appointments", label: "Appointments", icon: Calendar },
            { key: "doctors", label: "Doctors & Availability", icon: Stethoscope },
            { key: "patients", label: "Patient Records", icon: Users },
            { key: "payments", label: "Payment Accounts", icon: CreditCard },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TAB: APPOINTMENTS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "appointments" && (
          <div className="space-y-6">
            {/* Pending — require action */}
            {pending.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  Pending Approval ({pending.length})
                </h2>
                <div className="space-y-3">
                  {pending.map((a) => (
                    <AppointmentCard
                      key={a._id} appt={a} busyId={busyId}
                      expanded={expandedAppt === a._id}
                      onToggle={() => setExpandedAppt(expandedAppt === a._id ? null : a._id)}
                      onApprove={handleApprove} onReject={handleReject}
                      showActions
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Scheduled */}
            {scheduled.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" /> Scheduled ({scheduled.length})
                </h2>
                <div className="space-y-3">
                  {scheduled.map((a) => (
                    <AppointmentCard key={a._id} appt={a} busyId={busyId}
                      expanded={expandedAppt === a._id}
                      onToggle={() => setExpandedAppt(expandedAppt === a._id ? null : a._id)}
                      onApprove={handleApprove} onReject={handleReject} />
                  ))}
                </div>
              </section>
            )}

            {/* Others */}
            {allOther.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-gray-900 mb-3">History ({allOther.length})</h2>
                <div className="space-y-3">
                  {allOther.map((a) => (
                    <AppointmentCard key={a._id} appt={a} busyId={busyId}
                      expanded={expandedAppt === a._id}
                      onToggle={() => setExpandedAppt(expandedAppt === a._id ? null : a._id)}
                      onApprove={handleApprove} onReject={handleReject} />
                  ))}
                </div>
              </section>
            )}

            {appointments.length === 0 && !loading && (
              <EmptyState icon={Calendar} message="No appointments yet." />
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: DOCTORS & AVAILABILITY
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "doctors" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Registered Doctors ({doctors.length})</h2>
            {doctors.map((d) => {
              const avail = d.doctorProfile?.monthlyAvailability ?? [];
              const isOpen = expandedDoctor === d._id;
              return (
                <div key={d._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedDoctor(isOpen ? null : d._id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                        {d.firstName[0]}{d.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">Dr. {d.firstName} {d.lastName}</p>
                        <p className="text-xs text-gray-500">{d.doctorProfile?.specialty || "—"} · {d.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs">
                        {avail.length} availability day{avail.length !== 1 ? "s" : ""}
                      </Badge>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      {avail.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No availability set yet.</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {avail.map((slot, i) => (
                            <div key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                              <p className="text-xs font-bold text-gray-700 mb-2">{slot.date}</p>
                              {slot.segments.length === 0 ? (
                                <p className="text-xs text-gray-400">No segments</p>
                              ) : (
                                slot.segments.map((seg, j) => (
                                  <span key={j} className="inline-block text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-lg px-2 py-0.5 mr-1 mb-1">
                                    {seg.start} – {seg.end}
                                  </span>
                                ))
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Phone: {d.phone || "—"}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {doctors.length === 0 && !loading && <EmptyState icon={Stethoscope} message="No doctors registered yet." />}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: PATIENT RECORDS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "patients" && (
          <PatientRecordsTab
            appointments={appointments}
            onDownloadHistory={downloadMedicalHistory}
            loading={loading}
          />
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TAB: PAYMENT ACCOUNTS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "payments" && <PaymentAccountsTab />}
      </main>
    </div>
  );
}

// ── Appointment Card ──────────────────────────────────────────────────────────
function AppointmentCard({
  appt, busyId, expanded, onToggle, onApprove, onReject, showActions,
}: {
  appt: Appointment; busyId: string | null; expanded: boolean;
  onToggle: () => void; onApprove: (id: string) => void; onReject: (id: string) => void;
  showActions?: boolean;
}) {
  const busy = busyId === appt._id;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="hidden sm:flex flex-col items-center bg-blue-50 rounded-xl px-3 py-2 min-w-[60px] border border-blue-100">
            <span className="text-xs font-bold text-blue-600 uppercase">
              {new Date(appt.startAt).toLocaleString("en-GH", { month: "short" })}
            </span>
            <span className="text-xl font-black text-blue-700 leading-none">
              {new Date(appt.startAt).getDate()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[appt.status]}`}>
                {appt.status.toUpperCase()}
              </span>
              {appt.isPaid && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  PAID · GHS {Number(appt.amount || 0).toFixed(2)}
                </span>
              )}
            </div>
            <p className="font-semibold text-gray-900 truncate">
              {appt.patient ? `${appt.patient.firstName} ${appt.patient.lastName}` : "Unknown Patient"}
              <span className="text-gray-400 font-normal mx-1">→</span>
              Dr. {appt.doctor ? `${appt.doctor.firstName} ${appt.doctor.lastName}` : "Unknown"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{fmtDate(appt.startAt)} · {appt.consultationType || "In-Person"}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 ml-2 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 ml-2 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="Doctor specialty" value={appt.doctor?.doctorProfile?.specialty || "—"} />
            <Field label="Patient email" value={appt.patient?.email || "—"} />
            <Field label="Doctor email" value={appt.doctor?.email || "—"} />
            <Field label="Reason" value={appt.reason || "Not provided"} />
            {appt.notes && <Field label="Doctor notes" value={appt.notes} />}
            {appt.paymentDetails?.method && <Field label="Payment method" value={appt.paymentDetails.method} />}
            {appt.paymentDetails?.transactionId && <Field label="Transaction ID" value={appt.paymentDetails.transactionId} />}
          </div>
          {(showActions || appt.status === "pending") && appt.status === "pending" && (
            <div className="flex gap-3 pt-2">
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white gap-1.5"
                disabled={busy}
                onClick={() => onApprove(appt._id)}
              >
                <CheckCircle className="w-4 h-4" />
                {busy ? "Approving…" : "Approve & Send Receipt"}
              </Button>
              <Button
                size="sm" variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
                disabled={busy}
                onClick={() => onReject(appt._id)}
              >
                <XCircle className="w-4 h-4" />
                {busy ? "Rejecting…" : "Reject"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Patient Records Tab ───────────────────────────────────────────────────────
function PatientRecordsTab({
  appointments, onDownloadHistory, loading,
}: {
  appointments: Appointment[];
  onDownloadHistory: (id: string) => void;
  loading: boolean;
}) {
  // Group by patient
  const byPatient = new Map<string, { patient: Appointment["patient"]; appts: Appointment[] }>();
  appointments.forEach((a) => {
    if (!a.patient) return;
    const pid = a.patient._id;
    if (!byPatient.has(pid)) byPatient.set(pid, { patient: a.patient, appts: [] });
    byPatient.get(pid)!.appts.push(a);
  });
  const entries = Array.from(byPatient.values());

  if (loading) return <div className="py-12 text-center text-gray-400">Loading patient records…</div>;
  if (entries.length === 0) return <EmptyState icon={Users} message="No patient records yet." />;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Patient Visit Records ({entries.length})</h2>
      {entries.map(({ patient, appts }) => {
        const completed = appts.filter((a) => a.status === "completed" || a.status === "scheduled");
        return (
          <div key={patient!._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                  {patient!.firstName[0]}{patient!.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{patient!.firstName} {patient!.lastName}</p>
                  <p className="text-xs text-gray-500">{patient!.email} · {appts.length} appointment{appts.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <Button
                size="sm" variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => onDownloadHistory(patient!._id)}
              >
                <Download className="w-3.5 h-3.5" /> Medical History PDF
              </Button>
            </div>

            {completed.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visit History & Doctor Reports</p>
                {completed.map((a) => (
                  <div key={a._id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-sm">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[a.status]}`}>
                        {a.status.toUpperCase()}
                      </span>
                      <span className="text-gray-500 text-xs">{fmtDate(a.startAt)}</span>
                      <span className="text-gray-400 text-xs">Dr. {a.doctor?.firstName} {a.doctor?.lastName} ({a.doctor?.doctorProfile?.specialty})</span>
                    </div>
                    {a.reason && <p className="text-xs text-gray-600"><span className="font-medium">Reason:</span> {a.reason}</p>}
                    {a.notes ? (
                      <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2">
                        <p className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Doctor Report / Notes</p>
                        <p className="text-xs text-gray-700 whitespace-pre-line">{a.notes}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic mt-1">No doctor report yet.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
      <Icon className="w-12 h-12 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Payment Accounts Tab ──────────────────────────────────────────────────────
function PaymentAccountsTab() {
  const [accounts, setAccounts] = useState<AdminPaymentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: "", method: "Mobile Money", network: "MTN",
    bankName: "", accountNumber: "", accountName: "",
  });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ accounts: AdminPaymentAccount[] }>("/api/payments/admin-accounts");
      setAccounts(r.accounts);
    } catch { toast.error("Failed to load accounts"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchAccounts(); }, [fetchAccounts]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label || !form.accountNumber || !form.accountName) {
      toast.error("Label, account number, and account name are required.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/payments/admin-accounts", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success("Payment account added.");
      setForm({ label: "", method: "Mobile Money", network: "MTN", bankName: "", accountNumber: "", accountName: "" });
      void fetchAccounts();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to add account"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this payment account?")) return;
    try {
      await api(`/api/payments/admin-accounts/${id}`, { method: "DELETE" });
      toast.success("Account deleted.");
      void fetchAccounts();
    } catch { toast.error("Failed to delete account"); }
  }

  async function handleToggle(acc: AdminPaymentAccount) {
    try {
      await api(`/api/payments/admin-accounts/${acc._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !acc.isActive }),
      });
      void fetchAccounts();
    } catch { toast.error("Failed to update"); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Payment Receiving Accounts</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add your Mobile Money or bank account numbers here. Patients will see these at checkout and can choose which account to send payment to.
        </p>
      </div>

      {/* Add new account form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-600" /> Add New Account
        </h3>
        <form onSubmit={(e) => void handleAdd(e)} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Label (shown to patients) *</label>
            <Input placeholder="e.g. MTN MoMo - Admin Office" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Method *</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
              <option>Mobile Money</option>
              <option>Bank Transfer</option>
            </select>
          </div>
          {form.method === "Mobile Money" ? (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Network</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.network} onChange={e => setForm(f => ({ ...f, network: e.target.value }))}>
                <option>MTN</option><option>Telecel</option><option>AirtelTigo</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name</label>
              <Input placeholder="e.g. GTBank" value={form.bankName}
                onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account / Phone Number *</label>
            <Input placeholder="e.g. 0241234567" value={form.accountNumber}
              onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account Name *</label>
            <Input placeholder="e.g. Meddical Healthcare" value={form.accountName}
              onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} required />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Plus className="w-4 h-4" />{saving ? "Saving…" : "Add Account"}
            </Button>
          </div>
        </form>
      </div>

      {/* Existing accounts */}
      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={CreditCard} message="No payment accounts added yet. Add one above." />
      ) : (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Active Accounts ({accounts.filter(a => a.isActive).length})</h3>
          {accounts.map(acc => (
            <div key={acc._id} className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-4 ${acc.isActive ? "border-gray-100" : "border-gray-200 opacity-60"}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${acc.method === "Mobile Money" ? "bg-yellow-50 text-yellow-600" : "bg-blue-50 text-blue-600"}`}>
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{acc.label}</p>
                  <p className="text-xs text-gray-500">
                    {acc.accountName} · <strong>{acc.accountNumber}</strong>
                    {acc.network ? ` · ${acc.network}` : ""}
                    {acc.bankName ? ` · ${acc.bankName}` : ""}
                  </p>
                  <p className="text-xs text-gray-400">{acc.method}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void handleToggle(acc)}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${acc.isActive ? "border-green-200 text-green-700 bg-green-50 hover:bg-green-100" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                >
                  {acc.isActive ? "Active" : "Inactive"}
                </button>
                <button onClick={() => void handleDelete(acc._id)} className="text-red-400 hover:text-red-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
