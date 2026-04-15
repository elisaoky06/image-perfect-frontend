import teamGroup from "@/assets/team-group.jpg";
import doctorExamining from "@/assets/doctor-examining.jpg";
import doctorsTeam from "@/assets/doctors-team.jpg";
import { Calendar } from "lucide-react";

const articles = [
  {
    title: "A passion for putting patients first",
    excerpt: "Our commitment to patient-centered care drives everything we do, from diagnosis to recovery.",
    date: "March 15, 2026",
    image: teamGroup,
  },
  {
    title: "5 things to know about the flu vaccine",
    excerpt: "Important information about this season's flu vaccine and why it matters for your health.",
    date: "March 10, 2026",
    image: doctorExamining,
  },
  {
    title: "The benefits of regular health checkups",
    excerpt: "Regular health checkups can help find potential issues before they become serious problems.",
    date: "March 5, 2026",
    image: doctorsTeam,
  },
];

const NewsSection = () => {
  return (
    <section id="news" className="section-padding bg-cream">
      <div className="container-wide">
        <div className="text-center mb-14">
          <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">Better Information, Better Health</p>
          <h2 className="font-heading text-3xl sm:text-4xl text-foreground">News</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((article) => (
            <article key={article.title} className="group bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow">
              <div className="overflow-hidden h-52">
                <img
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-3">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{article.date}</span>
                </div>
                <h3 className="font-heading text-lg text-foreground mb-2 group-hover:text-accent transition-colors">
                  {article.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{article.excerpt}</p>
                <a href="#" className="inline-block mt-4 text-accent text-sm font-semibold hover:underline">
                  Read More →
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewsSection;
