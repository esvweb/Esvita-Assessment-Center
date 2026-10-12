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
 * [name, list price in EUR, unit, group]
 */
export const PRICE_LIST = [
  // Oral diagnosis
  ["Digital joint tomography", 200, "scan", null],
  ["General anaesthesia", 1200, "session", "Anaesthesia"],
  ["Sedation", 800, "session", "Anaesthesia"],

  // Implantology — surgical operations
  ["Surgical extraction", 150, "tooth", null],
  ["Bone grafting", 200, "cc", null],
  ["Apical resection", 250, "tooth", null],
  ["Gum grafting", 375, "site", null],
  ["Sinus lifting, one side", 500, "procedure", null],
  ["Sinus lifting, both sides", 850, "procedure", null],

  // Implantology — single implants
  ["Implant — Implance (Turkish)", 275, "implant", "Implant"],
  ["Implant — Osstem (Korea)", 370, "implant", "Implant"],
  ["Implant — Hiossen (USA)", 425, "implant", "Implant"],
  ["Implant — Megagen AnyRidge, immediate (S. Korea)", 675, "implant", "Implant"],
  ["Implant — Straumann (Swiss)", 1100, "implant", "Implant"],

  // Implantology — All-on series, priced per implant, multiunit included. Also
  // the line for a single implant that needs a multiunit abutment, which has no
  // price of its own; that is why single and All-on implants share a group.
  ["All-on implant — Implance (Turkish), multiunit incl.", 375, "implant", "Implant"],
  ["All-on implant — Osstem (Korea), multiunit incl.", 470, "implant", "Implant"],
  ["All-on implant — Hiossen (USA), multiunit incl.", 525, "implant", "Implant"],
  ["All-on implant — Straumann (Swiss), multiunit incl.", 1250, "implant", "Implant"],

  // Orthodontics
  ["Clear aligner (Istanbul Aligner)", 3000, "treatment", null],

  // Prosthetic dentistry
  ["Metal-fused ceramic crown", 120, "tooth", "Crown"],
  ["Zirconium crown", 150, "tooth", "Crown"],
  ["Zirconium-supported E-max crown", 190, "tooth", "Crown"],
  ["E-max crown", 225, "tooth", "Crown"],
  ["E-max laminate veneer", 275, "tooth", null],
  ["Acrylic prosthesis", 700, "jaw", "Full-arch prosthesis"],
  ["Hybrid prosthesis", 2750, "jaw", "Full-arch prosthesis"],
  ["Titanium bar prosthesis", 3250, "jaw", "Full-arch prosthesis"],

  // Dental comfort & protection
  ["Masseter botox", 450, "session", null],
  ["Temporary denture", 225, "jaw", null],
  ["Night guard", 200, "appliance", null],

  // Conservative dentistry / endodontics
  ["Composite filling", 60, "tooth", "Filling"],
  ["Aesthetic filling", 80, "tooth", "Filling"],
  ["Fiber post", 80, "tooth", null],
  ["Root canal treatment (incl. composite filling)", 125, "tooth", null],

  // Periodontology
  ["Cleaning", 60, "session", null],
  ["Curettage (full mouth)", 150, "session", null],
  ["Gingivectomy, one jaw", 160, "procedure", null],
  ["Gingivectomy, both jaws", 240, "procedure", null],

  // Hair operations
  ["PRP therapy", 200, "session", null],
  ["Sapphire FUE hair transplant — incl. 2 nights' hotel", 1799, "procedure", "Hair transplant"],
  ["DHI hair transplant, single session — incl. 2 nights' hotel", 1799, "procedure", "Hair transplant"],
  ["DHI hair transplant, double session — incl. 3 nights' hotel", 3299, "procedure", "Hair transplant"],
  ["Autologous micrograft treatment", 1399, "treatment", null],
  ["DHI + autologous micrograft package", 3199, "package", "Hair transplant"],
  ["Eyebrow transplant", 1799, "procedure", null],
  ["Beard transplant", 1799, "procedure", null],

  // Hair comfort & protection
  ["Mesotherapy", 300, "session", null],
  ["Post-op haircare vitamin set", 450, "set", null],
];
