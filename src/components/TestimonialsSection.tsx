import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";

type Testimonial = {
  _id: string;
  patient: { firstName: string; lastName: string };
  doctor?: { firstName: string; lastName: string };
  department?: string;
  rating: number;
  message: string;
  createdAt: string;
};

const TestimonialsSection = () => {
  const { data } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => api<{ testimonials: Testimonial[] }>("/api/testimonials"),
  });

  const testimonials = data?.testimonials || [];

  return (
    <section className="section-padding bg-background">
      <div className="container-wide px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in-up">
          <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-2">Patient Testimonials</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-foreground">What Our Patients Say</h2>
          <p className="text-muted-foreground mt-4">Read about the experiences of our satisfied patients.</p>
        </div>

        {testimonials.length === 0 ? (
          <p className="text-center text-muted-foreground">No testimonials yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.slice(0, 6).map((t) => (
              <Card key={t._id} className="border-border shadow-sm">
                <CardContent className="p-6">
                  <div className="flex text-yellow-400 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-5 w-5 ${i < t.rating ? "fill-current" : "text-gray-300"}`} />
                    ))}
                  </div>
                  <p className="text-foreground italic mb-6">"{t.message}"</p>
                  <div className="mt-auto">
                    <p className="font-semibold text-primary">
                      {t.patient.firstName} {t.patient.lastName.charAt(0)}.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Visited {t.doctor ? `Dr. ${t.doctor.firstName} ${t.doctor.lastName}` : t.department || "the hospital"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsSection;
