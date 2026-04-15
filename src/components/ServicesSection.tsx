import { Heart, Brain, Eye, Stethoscope, Bone, Baby } from "lucide-react";

const services = [
  { icon: Heart, title: "Cardiology", description: "Expert heart care with advanced diagnostic and treatment options for all cardiovascular conditions." },
  { icon: Brain, title: "Neurology", description: "Comprehensive neurological services for brain and nervous system disorders with cutting-edge technology." },
  { icon: Eye, title: "Ophthalmology", description: "Complete eye care services from routine exams to advanced surgical procedures for better vision." },
  { icon: Stethoscope, title: "General Medicine", description: "Primary healthcare services with personalized treatment plans for your overall wellness." },
  { icon: Bone, title: "Orthopedics", description: "Specialized bone and joint care including sports medicine, joint replacement, and rehabilitation." },
  { icon: Baby, title: "Pediatrics", description: "Dedicated healthcare for infants, children, and adolescents in a friendly environment." },
];

const ServicesSection = () => {
  return (
    <section id="services" className="section-padding bg-background">
      <div className="container-wide">
        <div className="text-center mb-14">
          <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">Care You Can Trust</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-foreground">Our Services</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="group bg-card border border-border rounded-xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-lg bg-sky-light flex items-center justify-center mb-5 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <service.icon className="h-7 w-7 text-accent group-hover:text-accent-foreground transition-colors" />
              </div>
              <h3 className="font-heading text-xl text-foreground mb-3">{service.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
