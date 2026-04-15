import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const contactInfo = [
  { icon: Phone, label: "Emergency", value: "(237) 681-812-255" },
  { icon: MapPin, label: "Location", value: "0123 Some Place, Some City" },
  { icon: Mail, label: "Email", value: "fillyourmail@gmail.com" },
  { icon: Clock, label: "Working Hours", value: "Mon-Sat 09:00-20:00" },
];

const ContactSection = () => {
  return (
    <section id="contact" className="section-padding bg-background">
      <div className="container-wide">
        <div className="text-center mb-14">
          <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">Get in Touch</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-foreground">Contact Us</h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="space-y-6">
            {contactInfo.map((item) => (
              <div key={item.label} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-sky-light flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{item.label}</p>
                  <p className="text-muted-foreground text-sm mt-0.5">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Name"
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
              />
            </div>
            <input
              type="text"
              placeholder="Subject"
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <textarea
              rows={5}
              placeholder="Message"
              className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
            />
            <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8 rounded-full">
              Send Message
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
