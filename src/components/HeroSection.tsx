import heroImg from "@/assets/doctor-hero.jpg";
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  return (
    <section id="home" className="relative bg-primary min-h-[90vh] flex items-center pt-20">
      <div className="container-wide px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6 animate-fade-in-up">
            <p className="text-accent font-medium text-sm tracking-widest uppercase">
              Leading the Way in Medical Excellence
            </p>
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl text-primary-foreground leading-tight">
              Best Care for Your Good Health
            </h1>
            <p className="text-primary-foreground/70 text-lg max-w-md leading-relaxed font-light">
              A Great Place to Receive Care. We provide comprehensive medical services with 
              compassionate care for every patient.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Button variant="default" size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 rounded-full" asChild>
                <a href="/appointments">Book an Appointment</a>
              </Button>
              <Button variant="outline" size="lg" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 rounded-full px-8">
                Learn More
              </Button>
            </div>
          </div>

          <div className="relative hidden lg:flex justify-end">
            <div className="relative">
              <img
                src={heroImg}
                alt="Professional doctor smiling"
                className="rounded-2xl shadow-2xl max-h-[550px] object-cover w-full"
              />
              <div className="absolute -bottom-6 -left-6 bg-accent text-accent-foreground rounded-xl p-4 shadow-lg">
                <p className="text-3xl font-bold">24/7</p>
                <p className="text-sm font-medium">Emergency Service</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
