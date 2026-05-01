import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const linkClass =
  "text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium tracking-wide transition-colors";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, loading } = useAuth();

  const navLinks = [
    { label: "Home", to: "/#home" },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-primary">
      <div className="container-wide flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 lg:h-20">
        <Link to="/#home" className="font-heading text-2xl lg:text-3xl text-primary-foreground tracking-wide">
          MEDDICAL
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8 flex-1 justify-end">
          <Link to="/#home" className={linkClass}>
            Home
          </Link>
          <Link to="/appointments" className={linkClass}>
            Appointments
          </Link>
          {!loading && user?.role === "doctor" && (
            <Link to="/doctor" className={linkClass}>
              Doctor portal
            </Link>
          )}
          {!loading && !user && (
            <>
              <Link to="/login" className={linkClass}>
                Sign in
              </Link>
              <Link to="/register" className={linkClass}>
                Register
              </Link>
            </>
          )}
          {!loading && user && (
            <button
              type="button"
              onClick={() => logout()}
              className={`${linkClass} bg-transparent border-none cursor-pointer`}
            >
              Log out ({user.firstName})
            </button>
          )}
          <div className="flex items-center gap-2 pl-4 border-l border-primary-foreground/20">
            <Phone className="h-4 w-4 text-accent" />
            <span className="text-primary-foreground text-sm font-medium">Emergency: 0509769303</span>
          </div>
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden text-primary-foreground">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="lg:hidden bg-primary border-t border-navy-light">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="block text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/appointments"
              className="block text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium py-2"
              onClick={() => setIsOpen(false)}
            >
              Appointments
            </Link>
            {user?.role === "doctor" && (
              <Link
                to="/doctor"
                className="block text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium py-2"
                onClick={() => setIsOpen(false)}
              >
                Doctor portal
              </Link>
            )}
            {!user && (
              <>
                <Link
                  to="/login"
                  className="block text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium py-2"
                  onClick={() => setIsOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="block text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium py-2"
                  onClick={() => setIsOpen(false)}
                >
                  Register
                </Link>
              </>
            )}
            {user && (
              <button
                type="button"
                className="block text-left w-full text-primary-foreground/80 hover:text-primary-foreground text-sm font-medium py-2"
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
              >
                Log out ({user.firstName})
              </button>
            )}
            <div className="flex items-center gap-2 pt-3 border-t border-navy-light">
              <Phone className="h-4 w-4 text-accent" />
              <span className="text-primary-foreground text-sm">Emergency: 0509769303</span>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
