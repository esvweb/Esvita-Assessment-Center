/**
 * SEED DATA ONLY.
 *
 * `db/seed.mts` loads these sections into the `brief_sections` table; the app
 * then reads them from the database so HR can edit them in the panel. Do not
 * import BRIEF at runtime — use `lib/brief.ts`.
 *
 * ⚠️ PLACEHOLDER DATA. Every number below is invented so the flow is testable
 * end to end. Replace with Esvita's real price list, brands, guarantee terms and
 * logistics before running a live assessment — the technical scoring is only as
 * accurate as this file.
 */

export interface BriefSection {
  title: string;
  body: string;
  bullets?: string[];
}

export const CLINIC = {
  name: "Esvita Clinic",
  city: "Istanbul, Türkiye",
  tagline: "Dental treatments and hair transplantation for international patients",
};

export const BRIEF: BriefSection[] = [
  {
    title: "Who we are",
    body: "Esvita Clinic is a private clinic in Istanbul treating international patients for dental work and hair transplantation. Most patients arrive from the UK, Ireland, Germany, the Netherlands, the Nordics and Malta. They find us online, message on WhatsApp, and decide from a distance — so trust is built entirely through how you handle them.",
    bullets: [
      "Founded 2016 · over 9,000 international patients treated",
      "12 dentists, 3 dedicated implantology surgeons, 2 hair transplant teams",
      "Treatment coordinator accompanies the patient throughout the stay",
      "Google rating 4.8 · verified patient reviews on Trustpilot",
    ],
  },
  {
    title: "What we treat",
    body: "You will be selling into one of these case types. You do not need to be a dentist — you need to be able to explain the plan clearly and honestly.",
    bullets: [
      "Smile design — E.max laminate veneers and zirconia crowns (typically 16–24 units)",
      "Implants — single, multiple, All-on-4 and All-on-6",
      "Full-mouth rehabilitation — extractions, implants, fixed zirconia bridges",
      "Redo cases — removing and replacing failed work from other clinics",
      "Hair transplantation — FUE and DHI",
    ],
  },
  {
    title: "Indicative prices (per unit, all-inclusive package rates)",
    body: "These are the package figures you can quote. They already include the items listed under 'What the package covers'. Discretion on discount is limited — see below.",
    bullets: [
      "Zirconia crown — €180 per unit",
      "E.max laminate veneer — €230 per unit",
      "Dental implant (Osstem) — €450 · (Nobel Biocare) — €750 · (Straumann) — €900",
      "Multiunit abutment — €120 each",
      "All-on-4 per jaw (4 implants + fixed zirconia bridge) — €4,200",
      "All-on-6 per jaw (6 implants + fixed zirconia bridge) — €5,400",
      "Bone graft — €300 per region · Sinus lift — €600 per side",
      "Extraction — €50 · Root canal — €120",
      "Hair transplant FUE up to 4,000 grafts — €2,200 · DHI up to 4,000 grafts — €2,700",
    ],
  },
  {
    title: "What the package covers",
    body: "Everything below is included in the quoted price. Patients ask about this constantly, and getting it wrong reads as improvisation.",
    bullets: [
      "Airport–hotel–clinic VIP transfers for the whole stay",
      "4-star hotel accommodation with breakfast for the patient (+1 companion at no extra charge)",
      "All consultations, panoramic x-ray and 3D tomography on arrival",
      "Local anaesthesia, medication and post-op kit",
      "English-speaking patient coordinator, available 24/7 during the stay",
      "Not included: flights, and any treatment added after the on-site examination",
    ],
  },
  {
    title: "Timelines and visits",
    body: "Be precise here. Over-promising on timelines is the single most common cause of complaints.",
    bullets: [
      "Smile design (veneers/crowns): one visit, 5–7 days. Temporaries fitted on day 2.",
      "Implants: two visits. Visit 1 (7–10 days) surgery + temporaries; 3–4 months healing at home; Visit 2 (7 days) final prosthesis.",
      "Immediate-loading All-on-4/6: fixed temporary teeth fitted within 72 hours of surgery. Patient is never toothless.",
      "Hair transplant: one visit, 3 days. First wash at the clinic on day 3.",
      "Redo cases: assessed on arrival; add 2–3 days over a standard plan.",
    ],
  },
  {
    title: "Guarantee",
    body: "Our written guarantee is issued to the patient by email before they travel, and again on paper at discharge.",
    bullets: [
      "Implants: lifetime guarantee on the fixture",
      "Zirconia crowns and bridges: 5 years",
      "E.max veneers: 3 years",
      "Hair transplant: graft survival guarantee — free touch-up if density targets are not met at 12 months",
      "Guarantee covers materials and workmanship. It does not cover trauma, or neglect of the aftercare protocol.",
      "If a covered failure occurs, the redo treatment and the hotel are free. Flights are the patient's responsibility.",
    ],
  },
  {
    title: "Booking, deposit and payment",
    body: "The reservation step is what turns an interested patient into a scheduled one.",
    bullets: [
      "Reservation deposit: €250, refundable up to 14 days before arrival",
      "Deposit is deducted from the total; it holds the surgeon's calendar slot",
      "Balance paid at the clinic — cash, card or transfer, in EUR or GBP",
      "The quoted price is locked once the deposit is paid; it does not change on arrival",
      "Free video consultation with the treating dentist can be arranged before any payment",
    ],
  },
  {
    title: "Medical honesty — non-negotiable",
    body: "You are allowed to lose a sale. You are not allowed to sell a patient a treatment that is unsafe for them. If a patient reports uncontrolled diabetes, heavy smoking, blood thinners, bisphosphonates, or recent chemotherapy, you must raise it and route them to a medical assessment before quoting a date.",
  },
];
