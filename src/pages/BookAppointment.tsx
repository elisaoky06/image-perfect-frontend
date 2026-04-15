import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getApiBase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Calendar } from "@/components/ui/calendar";
import doctorHero from "@/assets/doctor-hero.jpg";
import doctorLaptop from "@/assets/doctor-laptop.jpg";
import doctorFemale from "@/assets/doctor-female.jpg";

type DoctorRow = {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  doctorProfile?: { specialty?: string; bio?: string; profilePicture?: { storedFilename: string } };
};

type SlotDto = { start: string; end: string };

type MyAppointment = {
  _id: string;
  startAt: string;
  endAt: string;
  reason?: string;
  status: string;
  doctor?: { firstName: string; lastName: string; doctorProfile?: { specialty?: string } };
};

function groupSlots(slots: SlotDto[]) {
  const map = new Map<string, SlotDto[]>();
  for (const s of slots) {
    const key = s.start.slice(0, 10);
    const list = map.get(key) || [];
    list.push(s);
    map.set(key, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const BookAppointment = () => {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<DoctorRow | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [pickedSlot, setPickedSlot] = useState<SlotDto | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => api<{ doctors: DoctorRow[] }>("/api/doctors"),
  });

  const { data: slotPack, isFetching: slotsLoading } = useQuery({
    queryKey: ["doctor-slots", selected?._id],
    queryFn: () => api<{ slots: SlotDto[] }>(`/api/doctors/${selected!._id}/slots?days=21`),
    enabled: !!selected,
  });

  const { data: myAppts, refetch: refetchMine } = useQuery({
    queryKey: ["my-appts"],
    queryFn: () => api<{ appointments: MyAppointment[] }>("/api/appointments/mine"),
    enabled: !!user && user.role === "patient",
  });

  const imgs = [doctorHero, doctorLaptop, doctorFemale];
  
  const groupedSlots = useMemo(() => {
    const map = new Map<string, SlotDto[]>();
    for (const s of slotPack?.slots || []) {
      const key = s.start.slice(0, 10);
      const list = map.get(key) || [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [slotPack]);

  const dateStr = selectedDate 
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` 
    : null;
    
  const slotsForSelectedDate = dateStr ? groupedSlots.get(dateStr) || [] : [];
  const hasSlotsOnDate = (date: Date) => {
    const dStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return groupedSlots.has(dStr);
  };

  const downloadMedicalPdf = async () => {
    try {
      const base = getApiBase();
      const token = localStorage.getItem("token");
      const res = await fetch(`${base}/api/auth/me/medical-history/file`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const t = await res.text();
        let msg = "Could not download file";
        try {
          const j = JSON.parse(t) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-medical-history.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const book = async () => {
    if (!user || user.role !== "patient" || !selected || !pickedSlot) return;
    try {
      await api("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctorId: selected._id,
          start: pickedSlot.start,
          end: pickedSlot.end,
          reason,
        }),
      });
      toast.success("Appointment submitted! Pending confirmation by doctor.");
      setPickedSlot(null);
      setReason("");
      await qc.invalidateQueries({ queryKey: ["doctor-slots", selected._id] });
      await qc.invalidateQueries({ queryKey: ["my-appts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Booking failed");
    }
  };

  if (authLoading) {
    return (
      <SiteLayout>
        <div className="section-padding container-wide text-muted-foreground">Loading…</div>
      </SiteLayout>
    );
  }

  if (!user) {
    return (
      <SiteLayout>
        <div className="section-padding">
          <div className="container-wide max-w-lg mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Book an appointment</CardTitle>
                <CardDescription>Sign in or create a patient account to choose a doctor and time.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link to="/login?redirect=/appointments">Sign in</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/register">Register as patient</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (user.role !== "patient") {
    return (
      <SiteLayout>
        <div className="section-padding">
          <div className="container-wide max-w-lg mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Doctor account</CardTitle>
                <CardDescription>
                  Appointment booking is for patients. Use your portal to set availability and view visits.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Link to="/doctor">Open doctor portal</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="section-padding">
        <div className="container-wide space-y-12">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">Scheduling</p>
            <h1 className="font-heading text-3xl sm:text-4xl text-foreground">Book an appointment</h1>
            <p className="text-muted-foreground mt-3">
              Choose a clinician, then pick from their real-time available slots (30 minutes each).
            </p>
            {user?.patientProfile?.medicalHistoryUploaded ? (
              <div className="mt-6 flex justify-center">
                <Button type="button" variant="outline" onClick={() => void downloadMedicalPdf()}>
                  Download my medical history PDF
                </Button>
              </div>
            ) : null}
          </div>

          <div>
            <h2 className="font-heading text-2xl text-foreground mb-6">1. Select a doctor</h2>
            {isLoading ? (
              <p className="text-muted-foreground">Loading doctors…</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {(data?.doctors || []).map((doctor, i) => (
                  <button
                    key={doctor._id}
                    type="button"
                    onClick={() => {
                      setSelected(doctor);
                      setPickedSlot(null);
                      setSelectedDate(new Date());
                    }}
                    className={`text-left rounded-xl overflow-hidden shadow-md border transition-shadow bg-card ${
                      selected?._id === doctor._id ? "ring-2 ring-accent" : "border-border hover:shadow-xl"
                    }`}
                  >
                    <div className="h-56 overflow-hidden">
                      <img src={doctor.doctorProfile?.profilePicture?.storedFilename ? `${getApiBase()}/api/doctors/${doctor._id}/picture` : imgs[i % imgs.length]} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-6">
                      <h3 className="font-heading text-xl text-foreground">
                        Dr. {doctor.firstName} {doctor.lastName}
                      </h3>
                      <p className="text-accent text-sm font-medium mt-1">
                        {doctor.doctorProfile?.specialty || "General practice"}
                      </p>
                      {doctor.doctorProfile?.bio ? (
                        <p className="text-muted-foreground text-sm mt-2 line-clamp-3">{doctor.doctorProfile.bio}</p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {!isLoading && !(data?.doctors || []).length ? (
              <p className="text-muted-foreground">No doctors are registered yet. Please check back soon.</p>
            ) : null}
          </div>

          {selected && (
            <div className="space-y-6">
              <h2 className="font-heading text-2xl text-foreground">2. Choose a date and time</h2>
              {slotsLoading ? (
                <p className="text-muted-foreground">Loading availability…</p>
              ) : groupedSlots.size === 0 ? (
                <Card>
                  <CardContent className="py-6 text-muted-foreground">
                    This doctor has not published weekly hours yet, or all slots are full. Try another doctor or check
                    later.
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="w-full md:w-auto overflow-x-auto pb-4">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-md border bg-card inline-block"
                      disabled={(date) => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return date < today || !hasSlotsOnDate(date);
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-4">
                    <h3 className="font-semibold text-foreground">
                      {selectedDate ? selectedDate.toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }) : "Select a date"}
                    </h3>
                    
                    {!selectedDate ? (
                      <p className="text-muted-foreground text-sm">Please select a date from the calendar.</p>
                    ) : slotsForSelectedDate.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No available slots on this date.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {slotsForSelectedDate.map((s) => {
                          const active = pickedSlot?.start === s.start;
                          return (
                            <button
                              key={s.start}
                              type="button"
                              onClick={() => setPickedSlot(s)}
                              className={`px-3 py-2 rounded-full text-sm border transition-colors ${
                                active
                                  ? "bg-accent text-accent-foreground border-accent"
                                  : "border-border hover:border-accent hover:bg-accent/10"
                              }`}
                            >
                              {new Date(s.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                              {new Date(s.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="font-heading text-xl">3. Reason for visit (optional)</CardTitle>
                  <CardDescription>Brief notes help your care team prepare.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Notes</Label>
                    <Input
                      id="reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Symptoms or questions"
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!pickedSlot}
                    onClick={() => void book()}
                    className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  >
                    Confirm appointment
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div>
            <h2 className="font-heading text-2xl text-foreground mb-6">Your scheduled visits</h2>
            {!(myAppts?.appointments || []).length ? (
              <p className="text-muted-foreground text-sm">You do not have any upcoming appointments.</p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {(myAppts?.appointments || []).map((a) => (
                  <li key={a._id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {a.doctor
                          ? `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`
                          : "Doctor"}
                        {a.doctor?.doctorProfile?.specialty
                          ? ` · ${a.doctor.doctorProfile.specialty}`
                          : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(a.startAt).toLocaleString()} –{" "}
                        {new Date(a.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          a.status === "pending" ? "bg-yellow-100 text-yellow-800" 
                          : a.status === "scheduled" ? "bg-green-100 text-green-800" 
                          : "bg-gray-100 text-gray-800"
                        }`}>
                          {a.status === "pending" ? "Pending Confirmation" : a.status}
                        </span>
                      </p>
                      {a.reason ? <p className="text-sm mt-1 text-foreground/80">Note: {a.reason}</p> : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!window.confirm("Cancel this appointment?")) return;
                        try {
                          await api(`/api/appointments/${a._id}/cancel`, { method: "PATCH" });
                          toast.success("Appointment cancelled");
                          await refetchMine();
                          if (selected) {
                            await qc.invalidateQueries({ queryKey: ["doctor-slots", selected._id] });
                          }
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Could not cancel");
                        }
                      }}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
};

export default BookAppointment;
