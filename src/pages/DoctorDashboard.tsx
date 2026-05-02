import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ReceiptDialog } from "@/components/ReceiptDialog";
import { User, Calendar, Receipt, Download, Mail, CheckCircle2, XCircle, Bell } from "lucide-react";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Seg = { start: string; end: string };
type MonthlyRow = { date: string; segments: Seg[] };

type Appt = {
  _id: string;
  startAt: string;
  endAt: string;
  reason?: string;
  status: string;
  patient?: { firstName: string; lastName: string; email?: string; phone?: string };
  paymentStatus?: string;
  isPaid?: boolean;
  paymentDetails?: { method?: string; transactionId?: string };
  amount?: number;
  consultationType?: string;
  observations?: string;
  diagnosis?: string;
  recommendations?: string;
};

const DoctorDashboard = () => {
  const { user, loading, refreshUser } = useAuth();
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [newDate, setNewDate] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [qualification, setQualification] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [languagesSpoken, setLanguagesSpoken] = useState("");
  const [consultationFee, setConsultationFee] = useState("");
  const [tab, setTab] = useState<"profile" | "appointments" | "receipts" | "mail">("appointments");
  const [hospitalBranch, setHospitalBranch] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [receiptAppt, setReceiptAppt] = useState<string | null>(null);
  const [completingAppt, setCompletingAppt] = useState<string | null>(null);
  const [observations, setObservations] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [recommendations, setRecommendations] = useState("");

  // ── Notifications / Mail state ───────────────────────────────────────────
  type NotificationItem = {
    _id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    createdAt: string;
  };
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const res = await api<{ notifications: NotificationItem[]; unreadCount: number }>("/api/notifications");
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch { /* ignore */ }
    finally { setNotifLoading(false); }
  };

  useEffect(() => {
    if (user?.role === "doctor") { void fetchNotifications(); }
  }, [user]);

  const markNotifAsRead = async (id: string) => {
    try {
      await api(`/api/notifications/${id}/read`, { method: "PATCH" });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const markAllNotifRead = async () => {
    try {
      await api("/api/notifications/read-all", { method: "PATCH" });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!user || user.role !== "doctor") return;
    const m = user.doctorProfile?.monthlyAvailability || [];
    setMonthly(m.map((r: any) => ({
      date: r.date,
      segments: r.segments.map((s: any) => ({ ...s }))
    })).sort((a: any, b: any) => a.date.localeCompare(b.date)));
    setSpecialty(user.doctorProfile?.specialty || "");
    setBio(user.doctorProfile?.bio || "");
    setPhone(user.phone || "");
    setFirstName(user.firstName || "");
    setLastName(user.lastName || "");
    setQualification(user.doctorProfile?.qualification || "");
    setYearsOfExperience(user.doctorProfile?.yearsOfExperience?.toString() || "");
    setLicenseNumber(user.doctorProfile?.licenseNumber || "");
    setLanguagesSpoken((user.doctorProfile?.languagesSpoken || []).join(", "));
    setConsultationFee(user.doctorProfile?.consultationFee?.toString() || "");
    setHospitalBranch(user.doctorProfile?.hospitalBranch || "");
  }, [user]);

  const { data: apptData, refetch } = useQuery({
    queryKey: ["doctor-appts"],
    queryFn: () => api<{ appointments: Appt[] }>(`/api/appointments/mine?_t=${Date.now()}`),
    enabled: !!user && user.role === "doctor",
  });

  if (loading) {
    return (
      <SiteLayout>
        <div className="section-padding container-wide text-muted-foreground">Loading…</div>
      </SiteLayout>
    );
  }

  if (!user) {
    return <Navigate to="/login?redirect=/doctor" replace />;
  }

  if (user.role !== "doctor") {
    return (
      <SiteLayout>
        <div className="section-padding container-wide">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Clinician portal</CardTitle>
              <CardDescription>This area is reserved for registered doctors.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link to="/appointments">Book as a patient</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </SiteLayout>
    );
  }

  const addDateRow = () => {
    if (!newDate) return;
    if (monthly.some(r => r.date === newDate)) {
      toast.error("Date already added");
      return;
    }
    setMonthly(prev => [...prev, { date: newDate, segments: [{ start: "09:00", end: "16:00" }] }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate("");
  };

  const removeDateRow = (date: string) => {
    setMonthly(prev => prev.filter(r => r.date !== date));
  };

  const updateSegment = (date: string, idx: number, key: "start" | "end", value: string) => {
    setMonthly((prev) =>
      prev.map((row) => {
        if (row.date !== date) return row;
        const segs = row.segments.map((s, i) => (i === idx ? { ...s, [key]: value } : s));
        return { ...row, segments: segs };
      }),
    );
  };

  const addSegment = (date: string) => {
    setMonthly((prev) =>
      prev.map((row) =>
        row.date === date ? { ...row, segments: [...row.segments, { start: "09:00", end: "16:00" }] } : row,
      ),
    );
  };

  const removeSegment = (date: string, idx: number) => {
    setMonthly((prev) =>
      prev.map((row) =>
        row.date === date ? { ...row, segments: row.segments.filter((_, i) => i !== idx) } : row,
      ),
    );
  };

  const saveProfile = async () => {
    try {
      const fd = new FormData();
      fd.append("specialty", specialty);
      fd.append("bio", bio);
      fd.append("phone", phone);
      fd.append("firstName", firstName);
      fd.append("lastName", lastName);
      fd.append("qualification", qualification);
      fd.append("yearsOfExperience", yearsOfExperience);
      fd.append("licenseNumber", licenseNumber);
      fd.append("languagesSpoken", languagesSpoken);
      fd.append("consultationFee", consultationFee);
      fd.append("hospitalBranch", hospitalBranch);
      if (profilePicture) {
        fd.append("profilePicture", profilePicture);
      }

      await api("/api/doctors/me/profile", {
        method: "PATCH",
        body: fd,
      });
      toast.success("Profile saved");
      await refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const saveAvailability = async () => {
    const monthlyAvailability = monthly
      .filter((r) => r.segments.length)
      .map((r) => ({
        date: r.date,
        segments: r.segments.map((s) => ({ start: s.start, end: s.end })),
      }));
    try {
      await api("/api/doctors/me/availability", {
        method: "PATCH",
        body: JSON.stringify({ monthlyAvailability }),
      });
      toast.success("Availability updated");
      await refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const cancelAppt = async (id: string) => {
    if (!window.confirm("Cancel this appointment?")) return;
    try {
      await api(`/api/appointments/${id}/cancel`, { method: "PATCH" });
      toast.success("Appointment cancelled");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel");
    }
  };

  const startSession = async (id: string) => {
    try {
      await api(`/api/appointments/${id}/start`, { method: "PATCH" });
      toast.success("Session started");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start session");
    }
  };

  const completeAppt = async () => {
    if (!completingAppt) return;
    if (!observations.trim() || !diagnosis.trim() || !recommendations.trim()) {
      toast.error("All fields are required");
      return;
    }
    try {
      await api(`/api/appointments/${completingAppt}/complete`, {
        method: "PATCH",
        body: JSON.stringify({ observations, diagnosis, recommendations })
      });
      toast.success("Appointment completed");
      setCompletingAppt(null);
      setObservations("");
      setDiagnosis("");
      setRecommendations("");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete appointment");
    }
  };

  const downloadPatientMedicalPdf = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      // Use standard fetch to stream the blob
      // api from lib/api expects json by default
      const res = await fetch(`/api/appointments/${id}/medical-history`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = "Could not download file";
        try {
          const j = JSON.parse(text);
          if (j.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "patient-medical-history.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const appts = apptData?.appointments || [];
  const pendingAppts = appts.filter(a => a.status === "pending");
  const confirmedAppts = appts.filter(a => a.status === "confirmed" || a.status === "scheduled");
  const inProgressAppts = appts.filter(a => a.status === "in_progress");
  const doneAppts = appts.filter(a => a.status === "done");

  return (
    <SiteLayout>
      <div className="section-padding">
        <div className="container-wide space-y-10 max-w-4xl mx-auto">
          <div>
            <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-2">Clinician</p>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Doctor portal</h1>
            <p className="text-muted-foreground mt-2">
              Update how patients see you, publish your hours, and manage visits.
            </p>
          </div>

          <div className="flex flex-wrap gap-1 bg-white rounded-xl p-1 border border-border w-fit shadow-sm">
            {[
              { key: "appointments", label: "Appointments", icon: Calendar },
              { key: "profile", label: "Profile & Availability", icon: User },
              { key: "receipts", label: "Payment Receipts", icon: Receipt },
              { key: "mail", label: "Mail", icon: Mail },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => { setTab(key as any); if (key === "mail") void fetchNotifications(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === key
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {key === "mail" && unreadCount > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>

          {tab === "profile" && (
            <div className="space-y-10">
              <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Profile</CardTitle>
              <CardDescription>Displayed on the public doctors list and booking flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fn">First name</Label>
                  <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ln">Last name</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="spec">Specialty / field</Label>
                <Input id="spec" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-phone">Phone</Label>
                <Input id="portal-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="qual">Qualification (e.g. MBChB, MD)</Label>
                  <Input id="qual" value={qualification} onChange={(e) => setQualification(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yoe">Years of Experience</Label>
                  <Input id="yoe" type="number" value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="license">License Number (Unique)</Label>
                  <Input id="license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branch">Hospital Branch</Label>
                  <Input id="branch" value={hospitalBranch} onChange={(e) => setHospitalBranch(e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lang">Languages Spoken (comma separated)</Label>
                  <Input id="lang" value={languagesSpoken} onChange={(e) => setLanguagesSpoken(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee">Consultation Fee ($/GHS)</Label>
                  <Input id="fee" type="number" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profilePic">Profile Picture</Label>
                <Input 
                  id="profilePic" 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    setProfilePicture(f ?? null);
                  }}
                />
                <p className="text-xs text-muted-foreground">Upload a new profile picture to update it.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio2">Bio</Label>
                <textarea
                  id="bio2"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={() => void saveProfile()}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                Save profile
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Specific Date Availability</CardTitle>
              <CardDescription>
                Select specific dates you are available and add time ranges. Patients see 30-minute openings that are not already booked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2 items-end">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="newDate">Add Date</Label>
                  <Input type="date" id="newDate" value={newDate} onChange={(e) => setNewDate(e.target.value)} min={new Date().toISOString().split("T")[0]} />
                </div>
                <Button type="button" onClick={addDateRow}>Add Date</Button>
              </div>

              {monthly.length === 0 ? (
                <p className="text-sm text-muted-foreground">No dates configured. You are currently not accepting patients on any specific dates.</p>
              ) : (
                monthly.map((row) => (
                  <div key={row.date} className="border border-border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-foreground">
                        {new Date(row.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                      </h3>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => addSegment(row.date)}>
                          Add hours
                        </Button>
                        <Button type="button" variant="destructive" size="sm" onClick={() => removeDateRow(row.date)}>
                          Remove Date
                        </Button>
                      </div>
                    </div>
                    {row.segments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hours added for this date.</p>
                    ) : (
                      row.segments.map((seg, idx) => (
                        <div key={`${row.date}-${idx}`} className="flex flex-wrap gap-2 items-end">
                          <div className="space-y-1">
                            <Label>From</Label>
                            <Input
                              type="time"
                              value={seg.start}
                              onChange={(e) => updateSegment(row.date, idx, "start", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>To</Label>
                            <Input
                              type="time"
                              value={seg.end}
                              onChange={(e) => updateSegment(row.date, idx, "end", e.target.value)}
                            />
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeSegment(row.date, idx)}>
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                ))
              )}
              <Button type="button" onClick={() => void saveAvailability()} className="bg-primary text-primary-foreground">
                Save availability
              </Button>
            </CardContent>
          </Card>
          </div>
          )}

          {tab === "appointments" && (
          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Upcoming appointments</CardTitle>
              <CardDescription>Scheduled visits assigned to you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!pendingAppts.length && !confirmedAppts.length && !inProgressAppts.length && !doneAppts.length ? (
                <p className="text-muted-foreground text-sm">No upcoming appointments.</p>
              ) : (
                <div className="space-y-8">
                  {pendingAppts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-yellow-600 mb-3 block">Pending Approval ({pendingAppts.length})</h3>
                      <ul className="divide-y divide-border border rounded-lg bg-yellow-50/30">
                        {pendingAppts.map((a) => (
                          <li key={a._id} className="py-4 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Patient"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(a.startAt).toLocaleString()} – {new Date(a.endAt).toLocaleTimeString()}
                              </p>
                              {a.reason ? <p className="text-sm mt-1 text-foreground/80">Reason: {a.reason}</p> : null}
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                                {a.isPaid ? "Pending – Paid" : "Pending – Awaiting Payment"}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="secondary" size="sm" onClick={() => setReceiptAppt(a._id)}>
                                View Receipt
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {confirmedAppts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-green-600 mb-3 block">Scheduled Appointments</h3>
                      <ul className="divide-y divide-border border rounded-lg bg-green-50/30">
                        {confirmedAppts.map((a) => (
                          <li key={a._id} className="py-4 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Patient"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(a.startAt).toLocaleString()} – {new Date(a.endAt).toLocaleTimeString()}
                              </p>
                              {a.reason ? <p className="text-sm mt-1 text-foreground/80">Reason: {a.reason}</p> : null}
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="secondary" size="sm" onClick={() => setReceiptAppt(a._id)}>
                                View Receipt
                              </Button>
                              <Button type="button" variant="secondary" size="sm" onClick={() => void downloadPatientMedicalPdf(a._id)}>
                                Patient Medical PDF
                              </Button>
                              <Button type="button" variant="default" className="bg-blue-600 hover:bg-blue-700 text-white" size="sm" onClick={() => void startSession(a._id)}>
                                Start Session
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => void cancelAppt(a._id)}>
                                Cancel
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {inProgressAppts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-blue-600 mb-3 block">In Progress Sessions</h3>
                      <ul className="divide-y divide-border border rounded-lg bg-blue-50/30">
                        {inProgressAppts.map((a) => (
                          <li key={a._id} className="py-4 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">
                                {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Patient"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(a.startAt).toLocaleString()} – {new Date(a.endAt).toLocaleTimeString()}
                              </p>
                              {a.reason ? <p className="text-sm mt-1 text-foreground/80">Reason: {a.reason}</p> : null}
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="secondary" size="sm" onClick={() => setReceiptAppt(a._id)}>
                                View Receipt
                              </Button>
                              <Button type="button" variant="secondary" size="sm" onClick={() => void downloadPatientMedicalPdf(a._id)}>
                                Patient Medical PDF
                              </Button>
                              <Button type="button" variant="default" className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => setCompletingAppt(a._id)}>
                                Complete Appointment
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => void cancelAppt(a._id)}>
                                Cancel
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {doneAppts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-purple-600 mb-3 block">Completed Appointments</h3>
                      <ul className="divide-y divide-border border rounded-lg bg-purple-50/30">
                        {doneAppts.map((a) => (
                          <li key={a._id} className="py-4 px-4">
                            <div>
                              <p className="font-medium text-foreground">
                                {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Patient"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(a.startAt).toLocaleString()} – {new Date(a.endAt).toLocaleTimeString()}
                              </p>
                              {a.reason ? <p className="text-sm mt-1 text-foreground/80">Reason: {a.reason}</p> : null}
                              <p className="text-sm mt-1 text-foreground/80"><strong>Diagnosis:</strong> {a.diagnosis || "Not provided"}</p>
                              <p className="text-sm mt-1 text-foreground/80"><strong>Recommendations:</strong> {a.recommendations || "Not provided"}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {tab === "receipts" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">Payment Receipts</CardTitle>
                <CardDescription>View receipts for appointments that have been paid.</CardDescription>
              </CardHeader>
              <CardContent>
                {appts.filter(a => a.paymentStatus === "paid" || a.isPaid).length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">No paid appointments found.</div>
                ) : (
                  <ul className="divide-y divide-border border rounded-lg">
                    {appts.filter(a => a.paymentStatus === "paid" || a.isPaid).map(a => (
                      <li key={a._id} className="py-4 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">
                            {a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Patient"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(a.startAt).toLocaleString()}
                          </p>
                          <p className="text-sm font-semibold text-emerald-600">GHS {Number(a.amount || 0).toFixed(2)}</p>
                        </div>
                        <Button type="button" variant="secondary" onClick={() => setReceiptAppt(a._id)}>
                          <Receipt className="w-4 h-4 mr-2" /> View Receipt
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {tab === "mail" && (
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-xl">Mail / Notifications</CardTitle>
                <CardDescription>Messages from the administrator about your appointments.</CardDescription>
              </CardHeader>
              <CardContent>
                {notifLoading ? (
                  <p className="text-center text-muted-foreground">Loading notifications…</p>
                ) : notifications.length === 0 ? (
                  <div className="py-12 text-center">
                    <Mail className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">No messages yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {unreadCount > 0 && (
                      <div className="flex justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => void markAllNotifRead()}>
                          Mark all as read
                        </Button>
                      </div>
                    )}
                    <ul className="divide-y divide-border border rounded-lg">
                      {notifications.map((n) => (
                        <li
                          key={n._id}
                          className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                            !n.read ? "bg-blue-50/60 border-l-4 border-l-blue-500" : ""
                          }`}
                          onClick={() => { if (!n.read) void markNotifAsRead(n._id); }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                n.type === "appointment_approved" || n.type === "appointment_scheduled" ? "bg-green-100 text-green-600" :
                                n.type === "appointment_rejected" ? "bg-red-100 text-red-600" :
                                "bg-blue-100 text-blue-600"
                              }`}>
                                {n.type === "appointment_approved" || n.type === "appointment_scheduled" ? <CheckCircle2 className="w-4 h-4" /> :
                                 n.type === "appointment_rejected" ? <XCircle className="w-4 h-4" /> :
                                 <Bell className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <p className={`text-sm font-semibold ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                                  {n.title}
                                </p>
                                <p className="text-sm text-muted-foreground whitespace-pre-line mt-1">{n.message}</p>
                                <p className="text-xs text-muted-foreground/70 mt-2">
                                  {new Date(n.createdAt).toLocaleString("en-GH", {
                                    weekday: "short", year: "numeric", month: "short",
                                    day: "numeric", hour: "2-digit", minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            {!n.read && (
                              <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-blue-500 mt-2" />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Complete Appointment Dialog */}
      <Dialog open={!!completingAppt} onOpenChange={(open) => !open && setCompletingAppt(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete Appointment</DialogTitle>
            <DialogDescription>
              Please provide the post-session write-up for this appointment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="observations">Observations *</Label>
              <Textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="What did you observe during the session?"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="diagnosis">Diagnosis *</Label>
              <Textarea
                id="diagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Your formal diagnosis"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="recommendations">Recommendations *</Label>
              <Textarea
                id="recommendations"
                value={recommendations}
                onChange={(e) => setRecommendations(e.target.value)}
                placeholder="What should the patient do next?"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletingAppt(null)}>
              Cancel
            </Button>
            <Button
              onClick={completeAppt}
              disabled={!observations.trim() || !diagnosis.trim() || !recommendations.trim()}
            >
              Complete Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptDialog open={!!receiptAppt} onOpenChange={(open) => !open && setReceiptAppt(null)} appointmentId={receiptAppt || ""} />
    </SiteLayout>
  );
};

export default DoctorDashboard;
