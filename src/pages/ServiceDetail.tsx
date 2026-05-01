import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { api, getApiBase } from "@/lib/api";
import { Button } from "@/components/ui/button";
import doctorHero from "@/assets/doctor-hero.jpg";
import doctorLaptop from "@/assets/doctor-laptop.jpg";
import doctorFemale from "@/assets/doctor-female.jpg";
import { Heart, Brain, Eye, Stethoscope, Bone, Baby } from "lucide-react";

const SERVICES_DATA = [
  { icon: Heart, title: "Cardiology", description: "Expert heart care with advanced diagnostic and treatment options for all cardiovascular conditions. Our specialists are dedicated to heart health and surgery." },
  { icon: Brain, title: "Neurology", description: "Comprehensive neurological services for brain and nervous system disorders with cutting-edge technology. We handle complex neuro cases with utmost care." },
  { icon: Eye, title: "Ophthalmology", description: "Complete eye care services from routine exams to advanced surgical procedures for better vision. We correct refractive errors and treat eye diseases." },
  { icon: Stethoscope, title: "General Medicine", description: "Primary healthcare services with personalized treatment plans for your overall wellness. This is your first stop for comprehensive care." },
  { icon: Bone, title: "Orthopedics", description: "Specialized bone and joint care including sports medicine, joint replacement, and rehabilitation. Regain mobility with our experts." },
  { icon: Baby, title: "Pediatrics", description: "Dedicated healthcare for infants, children, and adolescents in a friendly environment. Compassionate pediatricians for your little ones." },
];

type DoctorRow = {
  _id: string;
  firstName: string;
  lastName: string;
  doctorProfile?: { specialty?: string; bio?: string; consultationFee?: number; profilePicture?: { storedFilename: string } };
};

const ServiceDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const service = SERVICES_DATA.find((s) => s.title.toLowerCase().replace(" ", "-") === slug);
  const Icon = service?.icon || Stethoscope;
  
  const { data, isLoading } = useQuery({
    queryKey: ["doctors-list"],
    queryFn: () => api<{ doctors: DoctorRow[] }>("/api/doctors"),
  });

  if (!service) {
    return (
      <SiteLayout>
        <div className="section-padding container-wide text-center">
          <h2 className="text-2xl font-bold mb-4">Service not found</h2>
          <Button asChild><Link to="/">Go Home</Link></Button>
        </div>
      </SiteLayout>
    );
  }

  // Find doctors that belong to this specialty (case-insensitive partial match)
  const matchingDoctors = (data?.doctors || []).filter(doc => 
    doc.doctorProfile?.specialty?.toLowerCase().includes(service.title.toLowerCase())
  );
  
  const imgs = [doctorHero, doctorLaptop, doctorFemale];

  return (
    <SiteLayout>
      <div className="section-padding bg-background">
        <div className="container-wide">
          {/* Header */}
          <div className="bg-muted rounded-2xl p-8 md:p-12 mb-12 text-center max-w-4xl mx-auto shadow-sm border border-border">
            <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon className="w-10 h-10 text-accent" />
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl text-foreground mb-4">{service.title}</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              {service.description}
            </p>
          </div>

          {/* Doctors List */}
          <div className="max-w-6xl mx-auto">
            <h2 className="font-heading text-3xl text-foreground mb-8 text-center">
              Specialists in {service.title}
            </h2>
            
            {isLoading ? (
              <p className="text-center text-muted-foreground">Loading doctors...</p>
            ) : matchingDoctors.length === 0 ? (
              <div className="text-center bg-card p-12 rounded-xl border border-border">
                <p className="text-muted-foreground mb-4">We currently do not have any registered specialists for {service.title}.</p>
                <Button asChild variant="outline">
                  <Link to="/appointments">View all Doctors</Link>
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {matchingDoctors.map((doctor, i) => (
                  <div key={doctor._id} className="bg-card rounded-xl overflow-hidden shadow-md border border-border flex flex-col">
                    <div className="h-56 overflow-hidden">
                      <img 
                        src={doctor.doctorProfile?.profilePicture?.storedFilename ? `${getApiBase()}/api/doctors/${doctor._id}/picture` : imgs[i % imgs.length]} 
                        alt={`Dr. ${doctor.firstName} ${doctor.lastName}`} 
                        className="w-full h-full object-cover transition-transform hover:scale-105 duration-500" 
                      />
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="font-heading text-xl text-foreground">
                        Dr. {doctor.firstName} {doctor.lastName}
                      </h3>
                      <p className="text-accent text-sm font-medium mt-1 mb-3">
                        {doctor.doctorProfile?.specialty || service.title}
                        {doctor.doctorProfile?.consultationFee ? ` · GHS ${doctor.doctorProfile.consultationFee}` : " · Free"}
                      </p>
                      {doctor.doctorProfile?.bio ? (
                        <p className="text-muted-foreground text-sm line-clamp-3 mb-6 flex-1">
                          {doctor.doctorProfile.bio}
                        </p>
                      ) : <div className="flex-1"></div>}
                      
                      <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                        <Link to={`/appointments?doctor=${doctor._id}`}>Book Appointment</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
};

export default ServiceDetail;
