import { Shield, Clock, CreditCard, Calendar, FileText, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const WhyChooseUsSection = () => {
  const reasons = [
    {
      title: "Experienced Doctors",
      description: "Our medical staff consists of highly qualified professionals with years of experience.",
      icon: <Shield className="h-8 w-8 text-accent" />,
    },
    {
      title: "24/7 Support",
      description: "We are available around the clock for any medical emergencies and inquiries.",
      icon: <Clock className="h-8 w-8 text-accent" />,
    },
    {
      title: "Online Payments",
      description: "Securely pay for your appointments using Mobile Money or Bank Transfer.",
      icon: <CreditCard className="h-8 w-8 text-accent" />,
    },
    {
      title: "Real-time Scheduling",
      description: "Book appointments instantly. Once booked, the slot is reserved just for you.",
      icon: <Calendar className="h-8 w-8 text-accent" />,
    },
    {
      title: "Secure Records",
      description: "Your medical history and patient data are stored safely and confidentially.",
      icon: <FileText className="h-8 w-8 text-accent" />,
    },
    {
      title: "Multiple Branches",
      description: "Find us at various convenient locations to get the care you need closer to home.",
      icon: <Building2 className="h-8 w-8 text-accent" />,
    },
  ];

  return (
    <section className="section-padding bg-muted">
      <div className="container-wide px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in-up">
          <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-2">Why Choose Us</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-foreground">Why Meddical is the Right Choice</h2>
          <p className="text-muted-foreground mt-4">We are committed to providing the highest quality healthcare with convenience and compassion.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reasons.map((reason, idx) => (
            <Card key={idx} className="border border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="mb-4 bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center">
                  {reason.icon}
                </div>
                <CardTitle className="font-heading text-xl text-foreground">{reason.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground text-sm">
                  {reason.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseUsSection;
