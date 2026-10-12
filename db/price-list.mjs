/**
 * Esvita's list prices, transcribed from the clinic's two price-list PDFs:
 * "Esvita Dental Treatment Price List" and "Hair AGC Price List" (the hair
 * list states it is valid until 31.08.2026).
 *
 * Each list price becomes a treatment's minimum: the plan form starts a line
 * at this figure and refuses anything lower, so a candidate can sell above
 * list but never discount below it.
 *
 * Order follows the PDFs section by section, which is also the order the
 * candidate sees in the plan form's dropdown. Names are spelled out where the
 * PDF relied on its section heading for meaning — "Osstem (Korea)" appears
 * under both single implants and All-on implants at different prices.
 *
 * Lines that share a group are alternatives to one another — implant brands,
 * crown materials, prosthesis types, hair transplant techniques. The upsell
 * analysis compares the candidate with the dentist by group, so choosing a
 * better brand reads as an upgrade rather than as one treatment dropped and an
 * unindicated one added. null means the line stands on its own.
 *
 * The last field is the specialty: a dental case only offers dental lines and
 * a hair case only hair ones, so a dental candidate never sees hair prices.
 *
 * [name, list price in EUR, unit, group, specialty]
 */
export const PRICE_LIST = [
  // Oral diagnosis
  ["Digital joint tomography", 200, "scan", null, "dental"],
  ["General anaesthesia", 1200, "session", "Anaesthesia", "dental"],
  ["Sedation", 800, "session", "Anaesthesia", "dental"],

  // Implantology — surgical operations
  ["Surgical extraction", 150, "tooth", null, "dental"],
  ["Bone grafting", 200, "cc", null, "dental"],
  ["Apical resection", 250, "tooth", null, "dental"],
  ["Gum grafting", 375, "site", null, "dental"],
  ["Sinus lifting, one side", 500, "procedure", null, "dental"],
  ["Sinus lifting, both sides", 850, "procedure", null, "dental"],

  // Implantology — single implants
  ["Implant — Implance (Turkish)", 275, "implant", "Implant", "dental"],
  ["Implant — Osstem (Korea)", 370, "implant", "Implant", "dental"],
  ["Implant — Hiossen (USA)", 425, "implant", "Implant", "dental"],
  ["Implant — Megagen AnyRidge, immediate (S. Korea)", 675, "implant", "Implant", "dental"],
  ["Implant — Straumann (Swiss)", 1100, "implant", "Implant", "dental"],

  // Implantology — All-on series, priced per implant, multiunit included. Also
  // the line for a single implant that needs a multiunit abutment, which has no
  // price of its own; that is why single and All-on implants share a group.
  ["All-on implant — Implance (Turkish), multiunit incl.", 375, "implant", "Implant", "dental"],
  ["All-on implant — Osstem (Korea), multiunit incl.", 470, "implant", "Implant", "dental"],
  ["All-on implant — Hiossen (USA), multiunit incl.", 525, "implant", "Implant", "dental"],
  ["All-on implant — Straumann (Swiss), multiunit incl.", 1250, "implant", "Implant", "dental"],

  // Orthodontics
  ["Clear aligner (Istanbul Aligner)", 3000, "treatment", null, "dental"],

  // Prosthetic dentistry
  ["Metal-fused ceramic crown", 120, "tooth", "Crown", "dental"],
  ["Zirconium crown", 150, "tooth", "Crown", "dental"],
  ["Zirconium-supported E-max crown", 190, "tooth", "Crown", "dental"],
  ["E-max crown", 225, "tooth", "Crown", "dental"],
  ["E-max laminate veneer", 275, "tooth", null, "dental"],
  ["Acrylic prosthesis", 700, "jaw", "Full-arch prosthesis", "dental"],
  ["Hybrid prosthesis", 2750, "jaw", "Full-arch prosthesis", "dental"],
  ["Titanium bar prosthesis", 3250, "jaw", "Full-arch prosthesis", "dental"],

  // Dental comfort & protection
  ["Masseter botox", 450, "session", null, "dental"],
  ["Temporary denture", 225, "jaw", null, "dental"],
  ["Night guard", 200, "appliance", null, "dental"],

  // Conservative dentistry / endodontics
  ["Composite filling", 60, "tooth", "Filling", "dental"],
  ["Aesthetic filling", 80, "tooth", "Filling", "dental"],
  ["Fiber post", 80, "tooth", null, "dental"],
  ["Root canal treatment (incl. composite filling)", 125, "tooth", null, "dental"],

  // Periodontology
  ["Cleaning", 60, "session", null, "dental"],
  ["Curettage (full mouth)", 150, "session", null, "dental"],
  ["Gingivectomy, one jaw", 160, "procedure", null, "dental"],
  ["Gingivectomy, both jaws", 240, "procedure", null, "dental"],

  // Hair operations
  ["PRP therapy", 200, "session", null, "hair"],
  ["Sapphire FUE hair transplant — incl. 2 nights' hotel", 1799, "procedure", "Hair transplant", "hair"],
  ["DHI hair transplant, single session — incl. 2 nights' hotel", 1799, "procedure", "Hair transplant", "hair"],
  ["DHI hair transplant, double session — incl. 3 nights' hotel", 3299, "procedure", "Hair transplant", "hair"],
  ["Autologous micrograft treatment", 1399, "treatment", null, "hair"],
  ["DHI + autologous micrograft package", 3199, "package", "Hair transplant", "hair"],
  ["Eyebrow transplant", 1799, "procedure", null, "hair"],
  ["Beard transplant", 1799, "procedure", null, "hair"],

  // Hair comfort & protection
  ["Mesotherapy", 300, "session", null, "hair"],
  ["Post-op haircare vitamin set", 450, "set", null, "hair"],
];

/**
 * Shown to the candidate under the price list while they build a plan, and
 * given to the patient and the grader. Markdown.
 */
export const PRICING_NOTES = `**Extractions**

- A simple extraction of a tooth that is being removed for an implant is free.
- If that extraction has to be surgical, it is charged as a surgical extraction, per tooth.
- All-on treatment clears the whole arch, so every simple extraction in an All-on arch is free — not only the teeth that receive an implant. Surgical extractions are still charged.`;
