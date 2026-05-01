import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ReceiptDialog } from "@/components/ReceiptDialog";

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
  paymentDetails?: { method?: string; transactionId?: string };
  amount?: number;
  consultationType?: string;
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
  const [hospitalBranch, setHospitalBranch] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [receiptAppt, setReceiptAppt] = useState<Appt | null>(null);

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
    queryFn: () => api<{ appointments: Appt[] }>("/api/appointments/mine"),
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

  const confirmAppt = async (id: string) => {
    try {
      await api(`/api/appointments/${id}/confirm`, { method: "PATCH" });
      toast.success("Appointment confirmed");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm");
    }
  };

  const completeAppt = async (id: string) => {
    try {
      await api(`/api/appointments/${id}/complete`, { method: "PATCH" });
      toast.success("Appointment marked as completed");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not mark as completed");
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
  const confirmedAppts = appts.filter(a => a.status === "scheduled");

  return (
    <SiteLayout>
      <div className="section-padding">
        <div className="container-wide space-y-10 max-w-4xl mx-auto">
          <div>
            <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-2">Clinician</p>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Doctor portal</h1>
            <p className="text-muted-foreground mt-2">
              Update how patients see you and publish the hours you accept appointments each week.
            </p>
          </div>

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

          <Card>
            <CardHeader>
              <CardTitle className="font-heading text-xl">Upcoming appointments</CardTitle>
              <CardDescription>Scheduled visits assigned to you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!confirmedAppts.length && !pendingAppts.length ? (
                <p className="text-muted-foreground text-sm">No upcoming appointments.</p>
              ) : (
                <div className="space-y-8">
                  {pendingAppts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-yellow-600 mb-3 block">Pending Confirmation</h3>
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
                            </div>
                            <div className="flex gap-2">
                              {a.paymentStatus === "paid" && (
                                <Button type="button" variant="secondary" size="sm" onClick={() => setReceiptAppt(a)}>
                                  View Receipt
                                </Button>
                              )}
                              <Button type="button" variant="default" className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => void confirmAppt(a._id)}>
                                Confirm
                              </Button>
                              <Button type="button" variant="outline" size="sm" onClick={() => void cancelAppt(a._id)}>
                                Reject
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {confirmedAppts.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-foreground mb-3 block">Scheduled Visits</h3>
                      <ul className="divide-y divide-border border rounded-lg">
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
                              {a.paymentStatus === "paid" && (
                                <Button type="button" variant="secondary" size="sm" onClick={() => setReceiptAppt(a)}>
                                  View Receipt
                                </Button>
                              )}
                              <Button type="button" variant="secondary" size="sm" onClick={() => void downloadPatientMedicalPdf(a._id)}>
                                Patient Medical PDF
                              </Button>
                              <Button type="button" className="bg-green-600 hover:bg-green-700 text-white" size="sm" onClick={() => void completeAppt(a._id)}>
                                Mark as Done
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <ReceiptDialog open={!!receiptAppt} onOpenChange={(open) => !open && setReceiptAppt(null)} appointment={receiptAppt} />
    </SiteLayout>
  );
};

export default DoctorDashboard;
