import { useQuery } from "@tanstack/react-query";
import { Facebook, Twitter, Linkedin } from "lucide-react";
import doctorHero from "@/assets/doctor-hero.jpg";
import doctorLaptop from "@/assets/doctor-laptop.jpg";
import doctorFemale from "@/assets/doctor-female.jpg";
import { api, getApiBase } from "@/lib/api";

const staticDoctors = [
  { name: "Dr. James Wilson", specialty: "Cardiology", image: doctorHero },
  { name: "Dr. Michael Chen", specialty: "Neurology", image: doctorLaptop },
  { name: "Dr. Sarah Johnson", specialty: "Pediatrics", image: doctorFemale },
];

type ApiDoctor = {
  _id: string;
  firstName: string;
  lastName: string;
  doctorProfile?: { specialty?: string; bio?: string; profilePicture?: { storedFilename: string } };
};

const DoctorsSection = () => {
  const { data, isError } = useQuery({
    queryKey: ["public-doctors-section"],
    queryFn: () => api<{ doctors: ApiDoctor[] }>("/api/doctors"),
  });

  const apiList = !isError && data?.doctors?.length ? data.doctors : null;
  const images = [doctorHero, doctorLaptop, doctorFemale];

  return (
    <section id="doctors" className="section-padding bg-background">
      <div className="container-wide">
        <div className="text-center mb-14">
          <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">Trusted Care</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-foreground">Our Doctors</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {apiList
            ? apiList.map((doctor, i) => (
                <div
                  key={doctor._id}
                  className="group bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow"
                >
                  <div className="overflow-hidden h-72">
                    <img
                      src={doctor.doctorProfile?.profilePicture?.storedFilename ? `${getApiBase()}/api/doctors/${doctor._id}/picture` : images[i % images.length]}
                      alt={`Dr. ${doctor.firstName} ${doctor.lastName}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 text-center">
                    <h3 className="font-heading text-xl text-foreground">
                      Dr. {doctor.firstName} {doctor.lastName}
                    </h3>
                    <p className="text-accent text-sm font-medium mt-1 mb-2">
                      {doctor.doctorProfile?.specialty || "Medical practice"}
                    </p>
                    {doctor.doctorProfile?.bio ? (
                      <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{doctor.doctorProfile.bio}</p>
                    ) : (
                      <p className="text-muted-foreground text-sm mb-4">&nbsp;</p>
                    )}
                    <div className="flex justify-center gap-3">
                      {[Facebook, Twitter, Linkedin].map((Icon, j) => (
                        <a
                          key={j}
                          href="#"
                          className="w-9 h-9 rounded-full bg-sky-light flex items-center justify-center text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            : staticDoctors.map((doctor) => (
                <div key={doctor.name} className="group bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                  <div className="overflow-hidden h-72">
                    <img
                      src={doctor.image}
                      alt={doctor.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 text-center">
                    <h3 className="font-heading text-xl text-foreground">{doctor.name}</h3>
                    <p className="text-accent text-sm font-medium mt-1 mb-4">{doctor.specialty}</p>
                    <div className="flex justify-center gap-3">
                      {[Facebook, Twitter, Linkedin].map((Icon, i) => (
                        <a
                          key={i}
                          href="#"
                          className="w-9 h-9 rounded-full bg-sky-light flex items-center justify-center text-accent hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
};

export default DoctorsSection;
