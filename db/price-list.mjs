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
 * [name, list price in EUR, unit]
 */
export const PRICE_LIST = [
  // Oral diagnosis
  ["Digital joint tomography", 200, "scan"],
  ["General anaesthesia", 1200, "session"],
  ["Sedation", 800, "session"],

  // Implantology — surgical operations
  ["Surgical extraction", 150, "tooth"],
  ["Bone grafting", 200, "cc"],
  ["Apical resection", 250, "tooth"],
  ["Gum grafting", 375, "site"],
  ["Sinus lifting, one side", 500, "procedure"],
  ["Sinus lifting, both sides", 850, "procedure"],

  // Implantology — single implants
  ["Implant — Implance (Turkish)", 275, "implant"],
  ["Implant — Osstem (Korea)", 370, "implant"],
  ["Implant — Hiossen (USA)", 425, "implant"],
  ["Implant — Megagen AnyRidge, immediate (S. Korea)", 675, "implant"],
  ["Implant — Straumann (Swiss)", 1100, "implant"],

  // Implantology — All-on series, priced per implant, multiunit included
  ["All-on implant — Implance (Turkish), multiunit incl.", 375, "implant"],
  ["All-on implant — Osstem (Korea), multiunit incl.", 470, "implant"],
  ["All-on implant — Hiossen (USA), multiunit incl.", 525, "implant"],
  ["All-on implant — Straumann (Swiss), multiunit incl.", 1250, "implant"],

  // Orthodontics
  ["Clear aligner (Istanbul Aligner)", 3000, "treatment"],

  // Prosthetic dentistry
  ["Metal-fused ceramic crown", 120, "tooth"],
  ["Zirconium crown", 150, "tooth"],
  ["Zirconium-supported E-max crown", 190, "tooth"],
  ["E-max crown", 225, "tooth"],
  ["E-max laminate veneer", 275, "tooth"],
  ["Acrylic prosthesis", 700, "jaw"],
  ["Hybrid prosthesis", 2750, "jaw"],
  ["Titanium bar prosthesis", 3250, "jaw"],

  // Dental comfort & protection
  ["Masseter botox", 450, "session"],
  ["Temporary denture", 225, "jaw"],
  ["Night guard", 200, "appliance"],

  // Conservative dentistry / endodontics
  ["Composite filling", 60, "tooth"],
  ["Aesthetic filling", 80, "tooth"],
  ["Fiber post", 80, "tooth"],
  ["Root canal treatment (incl. composite filling)", 125, "tooth"],

  // Periodontology
  ["Cleaning", 60, "session"],
  ["Curettage (full mouth)", 150, "session"],
  ["Gingivectomy, one jaw", 160, "procedure"],
  ["Gingivectomy, both jaws", 240, "procedure"],

  // Hair operations
  ["PRP therapy", 200, "session"],
  ["Sapphire FUE hair transplant — incl. 2 nights' hotel", 1799, "procedure"],
  ["DHI hair transplant, single session — incl. 2 nights' hotel", 1799, "procedure"],
  ["DHI hair transplant, double session — incl. 3 nights' hotel", 3299, "procedure"],
  ["Autologous micrograft treatment", 1399, "treatment"],
  ["DHI + autologous micrograft package", 3199, "package"],
  ["Eyebrow transplant", 1799, "procedure"],
  ["Beard transplant", 1799, "procedure"],

  // Hair comfort & protection
  ["Mesotherapy", 300, "session"],
  ["Post-op haircare vitamin set", 450, "set"],
];
