import { useEffect, useState } from "react";
import { zodula } from "@/zodula/client";
import { WebsiteNavbar } from "@/zodula/ui/components/custom/website-navbar";
import { Badge } from "@/zodula/ui/components/ui/badge";
import { Button } from "@/zodula/ui/components/ui/button";
import { Globe, Mail, MapPin, Phone } from "lucide-react";

function ensureUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return s.startsWith("http") ? s : `https://${s}`;
}

export default function AboutUsPage() {
  const [orgData, setOrgData] = useState<{ org: Record<string, unknown> | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    zodula
      .get_action("zodula.org.getInfo" as Zodula.ActionPath, {})
      .then((data: { org: Record<string, unknown> | null }) => {
        setOrgData(data ?? { org: null });
      })
      .catch((e: { message?: string }) => {
        setError(e?.message ?? "Failed to load organization");
        setOrgData({ org: null });
      })
      .finally(() => setLoading(false));
  }, []);

  const doc = orgData?.org ?? null;
  const o = (doc ?? {}) as Record<string, unknown>;
  const name = (o.organization_name as string) ?? (o.id as string) ?? "Organization";
  const abbr = (o.abbr as string)?.trim() || null;
  const taxId = (o.tax_id as string)?.trim() || null;
  const tagline = (o.tagline as string)?.trim() || null;
  const industry = (o.industry as string)?.trim() || null;
  const foundingYear = (o.founding_year as string)?.trim() || null;
  const supportHours = (o.support_hours as string)?.trim() || null;
  const aboutStory = (o.about_story as string)?.trim() || null;
  const mission = (o.mission as string)?.trim() || null;
  const vision = (o.vision as string)?.trim() || null;
  const value1 = (o.value_1 as string)?.trim() || null;
  const value2 = (o.value_2 as string)?.trim() || null;
  const value3 = (o.value_3 as string)?.trim() || null;
  const address = (o.address as string)?.trim() || null;
  const phone = (o.phone as string)?.trim() || null;
  const email = (o.email as string)?.trim() || null;
  const website = ensureUrl((o.website as string) ?? "");
  const bio = (o.bio as string)?.trim() || null;
  const coreValues = [value1, value2, value3].filter(Boolean) as string[];

  return (
    <div className="auth-page-bg zd:min-h-screen zd:flex zd:flex-col zd:relative">
      <WebsiteNavbar currentPage="About Us" />
      <main className="zd:relative zd:z-10 zd:flex-1 zd:px-4 zd:pt-24 zd:pb-8">
        <div className="zd:mx-auto zd:w-full zd:max-w-8xl">
          {loading ? (
            <div className="zd:flex zd:min-h-[50vh] zd:items-center zd:justify-center">
              <p className="zd:text-muted-foreground">Loading...</p>
            </div>
          ) : error || !doc ? (
            <div className="zd:flex zd:min-h-[50vh] zd:items-center zd:justify-center">
              <p className="zd:text-muted-foreground">{error ?? "Organization not found."}</p>
            </div>
          ) : (
            <div className="zd:space-y-5">
              <section className="zd:rounded-2xl zd:border zd:bg-background/95 zd:shadow-xl zd:shadow-black/10 zd:backdrop-blur-sm zd:p-6 md:zd:p-10">
                <div className="zd:grid zd:gap-8 lg:zd:grid-cols-[1.2fr,0.8fr]">
                  <div>
                    <Badge variant="secondary" className="zd:mb-4">
                      About Us
                    </Badge>
                    <h1 className="zd:text-3xl md:zd:text-4xl zd:font-semibold zd:tracking-tight">{name}</h1>
                    {tagline ? <p className="zd:mt-3 zd:max-w-2xl zd:text-lg zd:text-foreground/90">{tagline}</p> : null}
                    {bio ? <p className="zd:mt-3 zd:max-w-2xl zd:text-muted-foreground">{bio}</p> : null}
                    <div className="zd:mt-6 zd:flex zd:flex-wrap zd:gap-2">
                      {email ? <Button href={`mailto:${email}`}>Talk to us</Button> : null}
                      {website ? (
                        <Button variant="outline" href={website} target="_blank" rel="noopener noreferrer">
                          Visit website
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="zd:rounded-xl zd:border zd:bg-muted/30 zd:p-4 md:zd:p-5">
                    <p className="zd:text-sm zd:font-medium">Company Profile</p>
                    <dl className="zd:mt-3 zd:space-y-2">
                      {abbr ? (
                        <div className="zd:flex zd:items-baseline zd:justify-between zd:gap-3">
                          <dt className="zd:text-xs zd:text-muted-foreground">Abbreviation</dt>
                          <dd className="zd:text-sm zd:text-foreground zd:truncate">{abbr}</dd>
                        </div>
                      ) : null}
                      {industry ? (
                        <div className="zd:flex zd:items-baseline zd:justify-between zd:gap-3">
                          <dt className="zd:text-xs zd:text-muted-foreground">Industry</dt>
                          <dd className="zd:text-sm zd:text-foreground zd:truncate">{industry}</dd>
                        </div>
                      ) : null}
                      {foundingYear ? (
                        <div className="zd:flex zd:items-baseline zd:justify-between zd:gap-3">
                          <dt className="zd:text-xs zd:text-muted-foreground">Founded</dt>
                          <dd className="zd:text-sm zd:text-foreground zd:truncate">{foundingYear}</dd>
                        </div>
                      ) : null}
                      {taxId ? (
                        <div className="zd:flex zd:items-baseline zd:justify-between zd:gap-3">
                          <dt className="zd:text-xs zd:text-muted-foreground">Tax ID</dt>
                          <dd className="zd:text-sm zd:text-foreground zd:truncate">{taxId}</dd>
                        </div>
                      ) : null}
                      {website ? (
                        <div className="zd:flex zd:items-baseline zd:justify-between zd:gap-3">
                          <dt className="zd:text-xs zd:text-muted-foreground">Website</dt>
                          <dd className="zd:text-sm zd:text-foreground zd:truncate">{website}</dd>
                        </div>
                      ) : null}
                      {!abbr && !industry && !foundingYear && !taxId && !website ? (
                        <p className="zd:text-sm zd:text-muted-foreground">No public organization details available.</p>
                      ) : null}
                    </dl>
                  </div>
                </div>
              </section>

              {aboutStory ? (
                <section className="zd:rounded-2xl zd:border zd:bg-background/95 zd:p-6 md:zd:p-8">
                  <h2 className="zd:text-xl zd:font-semibold">Our Story</h2>
                  <p className="zd:mt-3 zd:whitespace-pre-line zd:text-muted-foreground">{aboutStory}</p>
                </section>
              ) : null}

              {mission || vision ? (
                <section className="zd:grid zd:gap-5 md:zd:grid-cols-2">
                  {mission ? (
                    <article className="zd:rounded-2xl zd:border zd:bg-background/95 zd:p-6">
                      <h2 className="zd:text-xl zd:font-semibold">Mission</h2>
                      <p className="zd:mt-3 zd:whitespace-pre-line zd:text-muted-foreground">{mission}</p>
                    </article>
                  ) : null}
                  {vision ? (
                    <article className="zd:rounded-2xl zd:border zd:bg-background/95 zd:p-6">
                      <h2 className="zd:text-xl zd:font-semibold">Vision</h2>
                      <p className="zd:mt-3 zd:whitespace-pre-line zd:text-muted-foreground">{vision}</p>
                    </article>
                  ) : null}
                </section>
              ) : null}

              {coreValues.length > 0 ? (
                <section className="zd:rounded-2xl zd:border zd:bg-background/95 zd:p-6 md:zd:p-8">
                  <h2 className="zd:text-xl zd:font-semibold">Core Values</h2>
                  <ul className="zd:mt-4 zd:grid zd:gap-3 md:zd:grid-cols-3">
                    {coreValues.map((value) => (
                      <li key={value} className="zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 zd:text-sm">
                        {value}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="zd:rounded-2xl zd:border zd:bg-background/95 zd:p-6 md:zd:p-8">
                <h2 className="zd:text-xl zd:font-semibold">Reach us</h2>
                {supportHours ? (
                  <p className="zd:mt-1 zd:text-sm zd:text-muted-foreground">Support hours: {supportHours}</p>
                ) : null}
                <div className="zd:mt-4 zd:grid zd:gap-3 md:zd:grid-cols-2">
                  {email ? (
                    <a
                      href={`mailto:${email}`}
                      className="zd:flex zd:items-center zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 hover:zd:bg-muted/50"
                    >
                      <Mail className="zd:h-4 zd:w-4 zd:text-primary" />
                      <span className="zd:text-sm">{email}</span>
                    </a>
                  ) : null}
                  {phone ? (
                    <a
                      href={`tel:${phone}`}
                      className="zd:flex zd:items-center zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 hover:zd:bg-muted/50"
                    >
                      <Phone className="zd:h-4 zd:w-4 zd:text-primary" />
                      <span className="zd:text-sm">{phone}</span>
                    </a>
                  ) : null}
                  {website ? (
                    <a
                      href={website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zd:flex zd:items-center zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 hover:zd:bg-muted/50"
                    >
                      <Globe className="zd:h-4 zd:w-4 zd:text-primary" />
                      <span className="zd:text-sm zd:truncate">{website}</span>
                    </a>
                  ) : null}
                  {address ? (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zd:flex zd:items-start zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 hover:zd:bg-muted/50"
                    >
                      <MapPin className="zd:mt-0.5 zd:h-4 zd:w-4 zd:text-primary" />
                      <span className="zd:text-sm zd:whitespace-pre-line">{address}</span>
                    </a>
                  ) : null}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
