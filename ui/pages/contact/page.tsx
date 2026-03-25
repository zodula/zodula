import { useEffect, useMemo, useState } from "react";
import { zodula } from "@/zodula/client";
import { WebsiteNavbar } from "@/zodula/ui/components/custom/website-navbar";
import { Button } from "@/zodula/ui/components/ui/button";
import { Input } from "@/zodula/ui/components/ui/input";
import { Textarea } from "@/zodula/ui/components/ui/textarea";
import { toast } from "@/zodula/ui/components/ui/toast";
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  Youtube,
} from "lucide-react";

const SOCIAL_FIELDS: { key: string; Icon: typeof Facebook }[] = [
  { key: "facebook_url", Icon: Facebook },
  { key: "twitter_url", Icon: Twitter },
  { key: "linkedin_url", Icon: Linkedin },
  { key: "instagram_url", Icon: Instagram },
  { key: "youtube_url", Icon: Youtube },
];

function ensureUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  return s.startsWith("http") ? s : `https://${s}`;
}

function logoUrlFromOrg(org: Record<string, unknown> | null): string {
  const raw = org?.logo;
  if (typeof raw === "string" && raw) {
    return (
      zodula.utils.getDoctypeFileUrl("Global Setting", "Global Setting", "logo", raw) + "?w=40&h=40"
    );
  }
  return "/public/zodula/zodula-logo.png";
}

function buildMailtoUrl(opts: {
  to: string;
  subject?: string;
  body?: string;
}): string {
  const to = (opts.to || "").trim();
  const subject = (opts.subject || "").trim();
  const body = (opts.body || "").trim();
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const qs = params.toString();
  return `mailto:${encodeURIComponent(to)}${qs ? `?${qs}` : ""}`;
}

export default function ContactPage() {
  const [orgData, setOrgData] = useState<{ org: Record<string, unknown> | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    name: "",
    email: "",
    subject: "",
    message: "",
  }));

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
  const navbarLogo = logoUrlFromOrg(doc);
  const o = (doc ?? {}) as unknown as Record<string, unknown>;
  const logoUrl = o.logo ?? null;
  const name = (o.organization_name as string) ?? (o.id as string) ?? "Organization";
  const address = (o.address as string)?.trim() || null;
  const phone = (o.phone as string)?.trim() || null;
  const email = (o.email as string)?.trim() || null;
  const website = ensureUrl((o.website as string) ?? "");

  const socialLinks = SOCIAL_FIELDS.filter(({ key }) => ensureUrl(o[key] as string));

  const canSend = useMemo(() => {
    const msg = form.message.trim();
    const subj = form.subject.trim();
    const from = form.email.trim();
    return !!(msg && (subj || msg.length >= 10) && from);
  }, [form.email, form.message, form.subject]);

  const mailtoHref = useMemo(() => {
    if (!email) return null;
    const subject = form.subject.trim() || `Contact request${form.name.trim() ? ` — ${form.name.trim()}` : ""}`;
    const bodyLines = [
      form.message.trim(),
      "",
      "—",
      `Name: ${form.name.trim() || "-"}`,
      `Email: ${form.email.trim() || "-"}`,
      website ? `Website: ${website}` : null,
    ].filter(Boolean) as string[];
    return buildMailtoUrl({ to: email, subject, body: bodyLines.join("\n") });
  }, [email, form.email, form.message, form.name, form.subject, website]);

  return (
    <div className="auth-page-bg zd:min-h-screen zd:flex zd:flex-col zd:relative">
      <WebsiteNavbar currentPage="Contact" logoUrl={navbarLogo} />
      <main className="zd:relative zd:z-10 zd:flex-1 zd:p-4 zd:pt-24">
        <div className="zd:mx-auto zd:w-full zd:max-w-5xl">
          {loading ? (
            <div className="zd:flex zd:min-h-[50vh] zd:items-center zd:justify-center">
              <p className="zd:text-muted-foreground">Loading...</p>
            </div>
          ) : error || !doc ? (
            <div className="zd:flex zd:min-h-[50vh] zd:items-center zd:justify-center">
              <p className="zd:text-muted-foreground">{error ?? "Organization not found."}</p>
            </div>
          ) : (
            <div className="zd:rounded-2xl zd:border zd:bg-background/95 zd:shadow-xl zd:shadow-black/10 zd:backdrop-blur-sm zd:overflow-hidden">
              <div className="zd:px-8 zd:py-7 md:zd:px-10 zd:bg-gradient-to-r zd:from-primary/10 zd:via-primary/5 zd:to-transparent">
                <div className="zd:flex zd:flex-wrap zd:items-center zd:gap-4">
                  {logoUrl && typeof logoUrl === "string" ? (
                    <div className="zd:flex zd:items-center zd:justify-center">
                      <img
                        src={
                          zodula.utils.getDoctypeFileUrl("Global Setting", "Global Setting", "logo", logoUrl) + "?w=120&h=120"
                        }
                        alt="Logo"
                        className="zd:h-12 zd:w-12 md:zd:h-14 md:zd:w-14 zd:object-contain zd:rounded-xl zd:ring-1 zd:ring-border/60 zd:bg-background"
                      />
                    </div>
                  ) : null}
                  <div className="zd:min-w-[220px]">
                    <p className="zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wide zd:text-muted-foreground">
                      Contact
                    </p>
                    <h1 className="zd:mt-1 zd:text-2xl md:zd:text-3xl zd:font-semibold zd:text-foreground zd:tracking-tight">
                      Get in touch with {name}
                    </h1>
                    <p className="zd:mt-2 zd:text-sm zd:text-muted-foreground">
                      Send us a message and we’ll respond as soon as we can.
                    </p>
                  </div>
                </div>
              </div>

              <div className="zd:px-8 zd:py-7 md:zd:px-10 zd:grid zd:grid-cols-1 lg:zd:grid-cols-[1.15fr,0.85fr] zd:gap-10">
                <section>
                <div className="zd:flex zd:items-center zd:justify-between zd:gap-3">
                  <h2 className="zd:text-sm zd:font-semibold zd:text-foreground">Message us</h2>
                  {mailtoHref ? (
                    <a
                      href={mailtoHref}
                      className="zd:text-xs zd:text-muted-foreground hover:zd:text-foreground zd:underline-offset-4 hover:zd:underline"
                    >
                      Open in email app
                    </a>
                  ) : null}
                </div>

                <form
                  className="zd:mt-4 zd:space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!email) {
                      toast.error("No support email configured", "Please contact us by phone or website.");
                      return;
                    }
                    if (!canSend || !mailtoHref) {
                      toast.error("Missing info", "Please enter your email and message.");
                      return;
                    }
                    window.location.href = mailtoHref;
                  }}
                >
                  <div className="zd:grid zd:grid-cols-1 md:zd:grid-cols-2 zd:gap-3">
                    <div>
                      <label className="zd:block zd:text-xs zd:font-semibold zd:text-muted-foreground">
                        Your name
                      </label>
                      <div className="zd:mt-1.5">
                        <Input
                          value={form.name}
                          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="John Doe"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="zd:block zd:text-xs zd:font-semibold zd:text-muted-foreground">
                        Your email
                      </label>
                      <div className="zd:mt-1.5">
                        <Input
                          type="email"
                          autocomplete="email"
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="you@example.com"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="zd:block zd:text-xs zd:font-semibold zd:text-muted-foreground">
                      Subject
                    </label>
                    <div className="zd:mt-1.5">
                      <Input
                        value={form.subject}
                        onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                        placeholder="How can we help?"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="zd:block zd:text-xs zd:font-semibold zd:text-muted-foreground">
                      Message
                    </label>
                    <div className="zd:mt-1.5">
                      <Textarea
                        value={form.message}
                        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                        placeholder="Tell us what you’re trying to do, and include any relevant order/document IDs."
                        required
                      />
                    </div>
                    <p className="zd:mt-2 zd:text-xs zd:text-muted-foreground">
                      Tip: include a Delivery Note ID if this is about tracking or installation.
                    </p>
                  </div>

                  <div className="zd:flex zd:flex-wrap zd:items-center zd:gap-2">
                    <Button type="submit" disabled={!canSend || !mailtoHref}>
                      Send message
                    </Button>
                    {phone ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          window.location.href = `tel:${phone}`;
                        }}
                      >
                        Call instead
                      </Button>
                    ) : null}
                  </div>
                </form>
                </section>

                <aside className="zd:space-y-3">
                <h2 className="zd:text-sm zd:font-semibold zd:text-foreground">Contact details</h2>

                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="zd:flex zd:items-center zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 zd:text-sm zd:text-foreground hover:zd:bg-muted/50 zd:transition-colors"
                  >
                    <span className="zd:flex zd:h-9 zd:w-9 zd:items-center zd:justify-center zd:rounded-full zd:bg-background">
                      <Mail className="zd:h-4 zd:w-4 zd:text-primary" />
                    </span>
                    <div className="zd:min-w-0">
                      <p className="zd:text-xs zd:text-muted-foreground">Email</p>
                      <p className="zd:truncate">{email}</p>
                    </div>
                  </a>
                ) : null}

                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="zd:flex zd:items-center zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 zd:text-sm zd:text-foreground hover:zd:bg-muted/50 zd:transition-colors"
                  >
                    <span className="zd:flex zd:h-9 zd:w-9 zd:items-center zd:justify-center zd:rounded-full zd:bg-background">
                      <Phone className="zd:h-4 zd:w-4 zd:text-primary" />
                    </span>
                    <div className="zd:min-w-0">
                      <p className="zd:text-xs zd:text-muted-foreground">Phone</p>
                      <p className="zd:truncate">{phone}</p>
                    </div>
                  </a>
                ) : null}

                {address ? (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zd:flex zd:items-start zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 zd:text-sm zd:text-foreground hover:zd:bg-muted/50 zd:transition-colors"
                  >
                    <span className="zd:flex zd:h-9 zd:w-9 zd:items-center zd:justify-center zd:rounded-full zd:bg-background">
                      <MapPin className="zd:h-4 zd:w-4 zd:text-primary" />
                    </span>
                    <div className="zd:min-w-0">
                      <p className="zd:text-xs zd:text-muted-foreground">Address</p>
                      <p className="zd:whitespace-pre-line">{address}</p>
                    </div>
                  </a>
                ) : null}

                {website ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zd:flex zd:items-center zd:gap-3 zd:rounded-xl zd:border zd:bg-muted/30 zd:px-4 zd:py-3 zd:text-sm zd:text-foreground hover:zd:bg-muted/50 zd:transition-colors"
                  >
                    <span className="zd:flex zd:h-9 zd:w-9 zd:items-center zd:justify-center zd:rounded-full zd:bg-background">
                      <Globe className="zd:h-4 zd:w-4 zd:text-primary" />
                    </span>
                    <div className="zd:min-w-0">
                      <p className="zd:text-xs zd:text-muted-foreground">Website</p>
                      <p className="zd:truncate">{website}</p>
                    </div>
                  </a>
                ) : null}

                {socialLinks.length > 0 ? (
                  <div className="zd:mt-4">
                    <p className="zd:text-xs zd:font-semibold zd:uppercase zd:tracking-wide zd:text-muted-foreground">
                      Social
                    </p>
                    <div className="zd:mt-2 zd:flex zd:flex-wrap zd:gap-2">
                      {SOCIAL_FIELDS.map(({ key, Icon }) => {
                        const url = ensureUrl(o[key] as string);
                        if (!url) return null;
                        return (
                          <a
                            key={key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="zd:p-2.5 zd:rounded-full zd:bg-muted/60 zd:text-muted-foreground hover:zd:bg-muted hover:zd:text-foreground zd:transition-colors"
                            aria-label={key.replace("_url", "")}
                          >
                            <Icon className="zd:w-4 zd:h-4" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
