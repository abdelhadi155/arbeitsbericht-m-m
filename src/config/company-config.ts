import { brandColors } from "./brand";

/**
 * Firmendaten – zentrale Stelle für alles, was im Formular, in der App und im PDF
 * über die Firma angezeigt wird. Hier ändern, nirgendwo sonst hart codieren.
 *
 * Übernommen aus dem bisherigen Papier-Arbeitsbericht (siehe docs/vorlage-scan.pdf).
 */
export interface CompanyConfig {
  name: string;
  /** Kurzform für App-Titel, Icons usw. */
  shortName: string;
  owner: string;
  address: {
    street: string;
    zip: string;
    city: string;
    country: string;
  };
  contact: {
    phone: string;
    mobile: string;
    email: string;
    website: string;
  };
  tax: {
    taxNumber: string;
    vatId?: string;
  };
  bank: {
    name: string;
    accountNumber?: string;
    bankCode?: string;
    bic: string;
    iban: string;
  };
  logo: {
    /**
     * Firmenlogo (PNG, quadratisch, transparenter Rand, Pfad unter /public).
     * Wird in der App und im PDF verwendet. Neues Logo: Datei ersetzen oder Pfad ändern.
     */
    src: string;
    alt: string;
  };
  brand: {
    /** Anthrazit/Schwarz aus Logo und Fußzeile des Papierformulars. */
    primary: string;
    /** Goldton aus Logo, Überschrift und Fußzeilen-Punkten. */
    accent: string;
  };
}

export const companyConfig: CompanyConfig = {
  name: "M&M Heizung & Sanitär",
  shortName: "M&M Arbeitsbericht",
  owner: "Mahmoud Issat",
  address: {
    // Auf der Vorlage ist keine Straße angegeben – bei Bedarf hier eintragen.
    street: "",
    zip: "32051",
    city: "Herford",
    country: "Deutschland",
  },
  contact: {
    phone: "05221-8737996",
    mobile: "01747620389",
    email: "info@mundmheizungsanitaer.com",
    website: "mundmheizungsanitaer.com",
  },
  tax: {
    taxNumber: "32450683126",
  },
  bank: {
    name: "Sparkasse Lemgo",
    accountNumber: "4081710",
    bankCode: "48250110",
    bic: "WELADED1LEM",
    iban: "DE51482501100004817190",
  },
  logo: {
    src: "/brand/mm-logo.png",
    alt: "M&M Heizung & Sanitär Logo",
  },
  brand: {
    primary: brandColors.ink,
    accent: brandColors.gold,
  },
};

/** IBAN in Vierergruppen, wie man sie auf Rechnungen erwartet. */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function companyAddressLines(config: CompanyConfig = companyConfig): string[] {
  const { street, zip, city, country } = config.address;
  return [street, `${zip} ${city}`.trim(), country].filter(Boolean);
}
