import { Link } from "react-router-dom";
import { Phone, MapPin, Mail } from "lucide-react";

const importantLinks = [
  { label: "Appointment", to: "/appointments" },
  { label: "Doctors", to: "/#doctors" },
  { label: "Services", to: "/#services" },
  { label: "About Us", to: "/#about" },
];

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container-wide section-padding pb-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="font-heading text-2xl">MEDDICAL</h3>
            <p className="text-primary-foreground/60 text-sm leading-relaxed">
              Leading the Way in Medical Excellence. Trusted care for your family.
            </p>
          </div>

          {/* Important Links */}
          <div>
            <h4 className="font-heading text-lg mb-4">Important Links</h4>
            <ul className="space-y-2">
              {importantLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.to}
                    className="text-primary-foreground/60 hover:text-primary-foreground text-sm transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-lg mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-primary-foreground/60 text-sm">
                <Phone className="h-4 w-4 text-accent" /> (237) 681-812-255
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/60 text-sm">
                <Mail className="h-4 w-4 text-accent" /> filly@gmail.com
              </li>
              <li className="flex items-start gap-2 text-primary-foreground/60 text-sm">
                <MapPin className="h-4 w-4 text-accent mt-0.5" /> 0123 Some Place, City
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-heading text-lg mb-4">Newsletter</h4>
            <p className="text-primary-foreground/60 text-sm mb-4">
              Subscribe to our newsletter for updates.
            </p>
            <form className="flex" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email"
                className="flex-1 px-3 py-2 rounded-l-lg bg-navy-light text-primary-foreground text-sm placeholder:text-primary-foreground/40 focus:outline-none"
              />
              <button type="submit" className="px-4 py-2 bg-accent text-accent-foreground text-sm font-semibold rounded-r-lg hover:bg-accent/90 transition-colors">
                Subscribe
              </button>
            </form>
          </div>
        </div>

        <div className="border-t border-navy-light mt-12 pt-6 text-center">
          <p className="text-primary-foreground/40 text-sm">
            © 2026 MEDDICAL. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
