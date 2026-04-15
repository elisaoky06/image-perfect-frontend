import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("General Medicine");
  const [bio, setBio] = useState("");
  const [medicalHistoryPdf, setMedicalHistoryPdf] = useState<File | null>(null);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (role === "patient") {
      if (!medicalHistoryPdf) {
        toast.error("Please upload your medical history as a PDF.");
        return;
      }
      const name = medicalHistoryPdf.name.toLowerCase();
      const typeOk =
        medicalHistoryPdf.type === "application/pdf" ||
        medicalHistoryPdf.type === "application/x-pdf" ||
        name.endsWith(".pdf");
      if (!typeOk) {
        toast.error("Medical history must be a PDF file.");
        return;
      }
    }

    if (role === "doctor") {
      if (!profilePicture) {
        toast.error("Please upload a profile picture.");
        return;
      }
      const typeOk = profilePicture.type.startsWith("image/");
      if (!typeOk) {
        toast.error("Profile picture must be an image file.");
        return;
      }
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("email", email.trim());
      fd.append("password", password);
      fd.append("firstName", firstName.trim());
      fd.append("lastName", lastName.trim());
      fd.append("phone", phone.trim());
      fd.append("role", role);

      if (role === "doctor") {
        fd.append("specialty", specialty.trim());
        fd.append("bio", bio.trim());
        if (profilePicture) {
          fd.append("profilePicture", profilePicture);
        }
      } else if (medicalHistoryPdf) {
        fd.append("medicalHistoryPdf", medicalHistoryPdf);
      }

      await register(fd);
      toast.success("Account created");
      navigate(role === "doctor" ? "/doctor" : "/appointments", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <div className="section-padding">
        <div className="container-wide max-w-lg mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Create an account</CardTitle>
              <CardDescription>Patients can book visits; doctors can publish their weekly availability.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4" encType="multipart/form-data">
                <div className="space-y-2">
                  <Label htmlFor="role">I am a</Label>
                  <select
                    id="role"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={role}
                    onChange={(e) => {
                      setRole(e.target.value as "patient" | "doctor");
                      setMedicalHistoryPdf(null);
                      setProfilePicture(null);
                    }}
                  >
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {role === "patient"
                      ? "Patients must attach a PDF medical history report below before creating an account."
                      : "Doctor accounts do not upload a patient medical report at registration."}
                  </p>
                </div>

                {role === "patient" && (
                  <div className="rounded-lg border-2 border-accent/40 bg-sky-light/50 dark:bg-primary/10 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Medical history report (PDF)</p>
                      <p className="text-xs text-muted-foreground mt-1">Required — one PDF, max 15 MB.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medicalPdf">Choose PDF file</Label>
                      <Input
                        id="medicalPdf"
                        name="medicalHistoryPdf"
                        type="file"
                        accept="application/pdf,.pdf"
                        required
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          setMedicalHistoryPdf(f ?? null);
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password (min 8 characters)</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>

                {role === "doctor" && (
                  <>
                    <div className="rounded-lg border-2 border-accent/40 bg-sky-light/50 dark:bg-primary/10 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Profile Picture</p>
                        <p className="text-xs text-muted-foreground mt-1">Required — patients will see this.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="profilePicture">Choose image</Label>
                        <Input
                          id="profilePicture"
                          name="profilePicture"
                          type="file"
                          accept="image/*"
                          required
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            setProfilePicture(f ?? null);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Medical specialty / field</Label>
                      <select
                        id="specialty"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        required
                      >
                        <option value="General Medicine">General Medicine</option>
                        <option value="Cardiology">Cardiology</option>
                        <option value="Neurology">Neurology</option>
                        <option value="Ophthalmology">Ophthalmology</option>
                        <option value="Orthopedics">Orthopedics</option>
                        <option value="Pediatrics">Pediatrics</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">About you (optional)</Label>
                      <textarea
                        id="bio"
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                      />
                    </div>
                  </>
                )}
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={busy}>
                  {busy ? "Creating account…" : "Create account"}
                </Button>
              </form>
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Already registered?{" "}
                <Link to="/login" className="text-accent font-medium hover:underline">
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </SiteLayout>
  );
};

export default Register;
