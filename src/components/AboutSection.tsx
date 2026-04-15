import aboutImg from "@/assets/doctor-patient.jpg";
import { CheckCircle } from "lucide-react";

const highlights = [
  "A Passion for Healing",
  "All Our Best Specialists",
  "5-Star Care with Heart",
  "Believe in Medical Excellence",
  "Always Caring, Always Here",
  "A Legacy of Quality Care",
];

const AboutSection = () => {
  return (
    <section id="about" className="section-padding bg-cream">
      <div className="container-wide">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative">
            <img
              src={aboutImg}
              alt="Doctor caring for patient"
              className="rounded-2xl shadow-lg w-full object-cover max-h-[480px]"
            />
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-accent rounded-2xl -z-10" />
          </div>

          <div className="space-y-6">
            <p className="text-accent font-semibold text-sm tracking-widest uppercase">About Us</p>
            <h2 className="font-heading text-3xl sm:text-4xl text-foreground leading-snug">
              Best Care for Your Good Health
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We are committed to providing the highest quality of medical care to our patients. 
              Our team of experienced doctors and medical professionals work together to ensure 
              comprehensive treatment with compassion and expertise.
            </p>

            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              {highlights.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-sm text-foreground font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;
