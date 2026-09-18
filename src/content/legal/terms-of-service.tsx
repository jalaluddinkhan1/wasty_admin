import Link from "next/link";

import { APP_CONFIG } from "@/config/app-config";

const { company, publicSite } = APP_CONFIG;

export function TermsOfServiceContent() {
  return (
    <>
      <p>
        These Terms of Service (“<strong>Terms</strong>”) form a binding agreement between you (“
        <strong>you</strong>”, “<strong>User</strong>”) and <strong>{company.legalName}</strong> (“
        <strong>GNUFOX</strong>”, “<strong>we</strong>”, “<strong>us</strong>”, or “
        <strong>our</strong>”) governing access to and use of the <strong>{publicSite.name}</strong>{" "}
        platform and related services (the “<strong>Services</strong>”).
      </p>
      <p>
        The Services include the Wasty customer app (<code>com.mywasty.app</code> and successors),
        the Wasty Partner app, public websites (including <code>{publicSite.domain}</code> and our
        hosting / Amplify domains), the Admin / operations console, APIs, SMS/OTP, maps, marketplace,
        rewards, and support channels.
      </p>
      <p>
        By downloading, accessing, or using the Services, creating an account, or clicking “agree”
        where presented, you accept these Terms and our{" "}
        <Link href="/privacy">Privacy Policy</Link>. If you do not agree, do not use the Services.
      </p>
      <p className="text-muted-foreground text-sm">
        These Terms are intended for operational clarity and app-store compliance. They do not
        constitute personalised legal advice. Business customers may be offered separate written
        agreements that prevail over these Terms to the extent of conflict.
      </p>

      <h2 id="definitions">1. Definitions</h2>
      <ul>
        <li>
          <strong>Customer</strong> — a household, individual, or business that schedules pickups,
          buys products, or uses rewards.
        </li>
        <li>
          <strong>Partner</strong> — a collector, driver, or field operator onboarded to perform
          assigned jobs.
        </li>
        <li>
          <strong>Admin User</strong> — an authorised staff member of GNUFOX or an operator using
          the console.
        </li>
        <li>
          <strong>Job / Pickup</strong> — a scheduled or assigned waste collection task.
        </li>
        <li>
          <strong>Content</strong> — text, images, documents, ratings, and other materials submitted
          to the Services.
        </li>
      </ul>

      <h2 id="eligibility">2. Eligibility and accounts</h2>
      <p>
        You must be at least <strong>18 years old</strong> and capable of entering a binding contract
        under Indian law. Partners must complete KYC / onboarding and maintain accurate documents.
        You agree to provide true, current information and to keep your phone number and devices
        secure. You are responsible for all activity under your account. Do not share OTP codes.
        Notify us immediately of unauthorised use at{" "}
        <a href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a>.
      </p>
      <p>
        We may refuse registration, suspend, or terminate accounts that appear fraudulent, unsafe,
        or non-compliant.
      </p>

      <h2 id="licence">3. Licence to use the Services</h2>
      <p>
        Subject to these Terms, we grant you a limited, non-exclusive, non-transferable,
        revocable licence to use the Services for their intended purposes. You may not: reverse
        engineer the apps (except to the extent permitted by law); scrape or overload our systems;
        bypass security; rent or sublicense access; or use the Services to build a competing
        service using our confidential operational data.
      </p>

      <h2 id="customer">4. Customer terms — pickups, marketplace, rewards</h2>
      <h3>4.1 Pickups</h3>
      <p>
        Scheduling a pickup is a request for service within our operating areas and slots. We do not
        guarantee a specific Partner, exact arrival time, or that every request can be fulfilled.
        ETAs are estimates. You must provide safe access, accurate pins/addresses, and waste
        prepared as instructed (segregation, banned items, etc.).
      </p>
      <h3>4.2 Cancellations</h3>
      <p>
        You may cancel a scheduled pickup before a Partner is en route / on the way, subject to
        in-app rules. Late cancellations, no-shows, or inaccessible locations may result in skipped
        service or future scheduling limits.
      </p>
      <h3>4.3 Marketplace</h3>
      <p>
        Product descriptions, pricing, stock, and delivery estimates may change. Orders are accepted
        when we confirm them. Risk in goods passes as stated at checkout or on delivery confirmation.
        Returns, if offered, follow the return window shown for each product.
      </p>
      <h3>4.4 Rewards and points</h3>
      <p>
        Eco-points and similar balances are promotional / loyalty instruments with{" "}
        <strong>no cash value</strong> except where a listed redemption expressly states otherwise.
        We may adjust, expire, or discontinue rewards programmes with reasonable notice where
        practicable. Abuse (fraudulent scans, fake pickups) may void balances.
      </p>
      <h3>4.5 Subscriptions</h3>
      <p>
        In-app subscription or plan selections are preferences until billing is enabled and you
        complete any required payment authorisation. Recurring charges, if any, will be disclosed
        before you confirm.
      </p>

      <h2 id="partner">5. Partner terms</h2>
      <p>Partners agree that:</p>
      <ul>
        <li>They will perform only assigned Jobs and follow safety and handling instructions;</li>
        <li>KYC documents remain valid, accurate, and up to date;</li>
        <li>
          Live location may be collected while Online / on Job for dispatch and customer ETA;
        </li>
        <li>
          Customer personal data (address, phone, photos) will be used solely to complete the Job
          and not for marketing, harassment, or unrelated contact;
        </li>
        <li>
          Collection proof photos and weight/category data will be truthful;
        </li>
        <li>
          Payouts are processed by Wasty ops according to settlement rules; the apps do not
          themselves transfer bank funds without a payment provider / ops workflow;
        </li>
        <li>
          They are independent service providers unless a separate employment contract says
          otherwise; Partners are responsible for their own licences, insurance, and tax filings as
          applicable.
        </li>
      </ul>
      <p>
        We may deactivate Partners for safety incidents, fraud, KYC failure, poor performance, or
        Terms violations.
      </p>

      <h2 id="acceptable-use">6. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>Use the Services for unlawful dumping, hazardous waste without disclosure, or crime;</li>
        <li>Harass, threaten, or discriminate against Customers, Partners, or staff;</li>
        <li>Upload illegal, infringing, or deceptive Content;</li>
        <li>Interfere with QR/bag integrity, spoof locations, or manipulate rewards;</li>
        <li>Probe, scan, or attack our systems or other users’ accounts;</li>
        <li>Misrepresent affiliation with GNUFOX, municipalities, or regulators.</li>
      </ul>

      <h2 id="content">7. User Content and licence</h2>
      <p>
        You retain ownership of Content you submit (e.g., profile info, photos, messages). You grant
        GNUFOX a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, and
        display that Content solely to operate, improve, and secure the Services and to meet
        compliance / chain-of-custody needs. You represent that you have rights to submit the
        Content and that it does not violate law or third-party rights.
      </p>

      <h2 id="ip">8. Intellectual property</h2>
      <p>
        The Services, including software, logos, trademarks (“Wasty”), UI, and documentation, are
        owned by {company.legalName} or its licensors. Except for the limited licence in Section 3,
        no rights are granted. Feedback you provide may be used by us without obligation to you.
      </p>

      <h2 id="third-party">9. Third-party services</h2>
      <p>
        Maps, SMS, cloud hosting, app stores, and payment providers are third parties. Your use of
        those services may be subject to their terms. We are not responsible for third-party
        outages beyond our reasonable control, though we will work to restore Service continuity.
      </p>

      <h2 id="fees">10. Fees, taxes, and payouts</h2>
      <p>
        Some Services may be free; others may involve pickup fees, marketplace prices, subscriptions,
        or Partner payouts. Prices are shown in-app in Indian Rupees unless stated otherwise. Taxes
        may apply. You authorise applicable charges through the payment methods you select. Partner
        payouts are subject to verification, offsets for chargebacks/losses, and KYC clearance.
      </p>

      <h2 id="disclaimers">11. Disclaimers</h2>
      <p>
        THE SERVICES ARE PROVIDED ON AN “AS IS” AND “AS AVAILABLE” BASIS. TO THE FULLEST EXTENT
        PERMITTED BY LAW, GNUFOX DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT
        UNINTERRUPTED OR ERROR-FREE OPERATION, EXACT ETAS, COMPLETE CATALOG ACCURACY, OR THAT
        WASTE HANDLING WILL MEET EVERY MUNICIPAL STANDARD WITHOUT YOUR COOPERATION.
      </p>
      <p>
        Nothing in these Terms excludes rights that cannot be excluded under Indian consumer
        protection law.
      </p>

      <h2 id="liability">12. Limitation of liability</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, {company.legalName} AND ITS DIRECTORS, EMPLOYEES,
        AND AGENTS SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY,
        OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, ARISING FROM THE SERVICES.
      </p>
      <p>
        OUR AGGREGATE LIABILITY FOR CLAIMS RELATING TO THE SERVICES SHALL NOT EXCEED THE GREATER OF:
        (A) THE AMOUNTS YOU PAID TO US FOR THE SPECIFIC PAID SERVICE GIVING RISE TO THE CLAIM IN THE
        THREE (3) MONTHS BEFORE THE CLAIM; OR (B) INR 1,000 (ONE THOUSAND RUPEES).
      </p>
      <p>
        Some jurisdictions do not allow certain limitations; in those cases, our liability is
        limited to the maximum extent permitted.
      </p>

      <h2 id="indemnity">13. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless {company.legalName} from claims, damages, losses,
        and expenses (including reasonable legal fees) arising out of your: (a) misuse of the
        Services; (b) breach of these Terms; (c) violation of law or third-party rights; or (d)
        Content you submit — except to the extent caused by our wilful misconduct.
      </p>

      <h2 id="suspension">14. Suspension and termination</h2>
      <p>
        You may stop using the Services at any time and request account deletion as described in the
        Privacy Policy. We may suspend or terminate access immediately for Terms violations, legal
        risk, non-payment, safety issues, or extended inactivity. Provisions that by nature should
        survive (IP, liability, indemnity, disputes) will survive termination.
      </p>

      <h2 id="privacy">15. Privacy</h2>
      <p>
        Personal data is handled according to our <Link href="/privacy">Privacy Policy</Link>,
        which is incorporated by reference. Device permissions (location, camera, notifications)
        are optional until you grant them but may be required for specific features.
      </p>

      <h2 id="changes">16. Changes to the Services and Terms</h2>
      <p>
        We may modify features, coverage areas, pricing, and these Terms. Material changes will be
        indicated by updating the “Last updated” date and, where appropriate, additional notice.
        Continued use after the effective date constitutes acceptance, except where mandatory
        consent is required.
      </p>

      <h2 id="law">17. Governing law and disputes</h2>
      <p>
        These Terms are governed by the laws of India, without regard to conflict-of-law rules.
        Courts in India shall have exclusive jurisdiction, subject to mandatory consumer
        protections and any statutory dispute forums that apply to you.
      </p>
      <p>
        Before filing a formal dispute, please contact{" "}
        <a href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a> so we can attempt an
        informal resolution.
      </p>

      <h2 id="general">18. General</h2>
      <ul>
        <li>
          <strong>Entire agreement.</strong> These Terms and the Privacy Policy are the entire
          agreement regarding the Services, unless a separate signed contract applies.
        </li>
        <li>
          <strong>Severability.</strong> If any provision is unenforceable, the remainder stays in
          effect.
        </li>
        <li>
          <strong>Waiver.</strong> Failure to enforce a provision is not a waiver.
        </li>
        <li>
          <strong>Assignment.</strong> You may not assign these Terms without our consent. We may
          assign to an affiliate or successor.
        </li>
        <li>
          <strong>Force majeure.</strong> We are not liable for delays caused by events beyond
          reasonable control (natural disasters, network failures, strikes, epidemics, government
          actions).
        </li>
        <li>
          <strong>Notices.</strong> We may notify you via in-app message, SMS, email, or website
          posting. Legal notices to us:{" "}
          <a href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a>.
        </li>
        <li>
          <strong>Language.</strong> These Terms are in English. If we provide translations, English
          controls unless law requires otherwise.
        </li>
      </ul>

      <h2 id="contact">19. Contact</h2>
      <p>
        {company.legalName}
        <br />
        Product: {publicSite.name} ({publicSite.domain})
        <br />
        Support: <a href={`mailto:${company.supportEmail}`}>{company.supportEmail}</a>
        <br />
        Privacy: <a href={`mailto:${company.privacyEmail}`}>{company.privacyEmail}</a>
        <br />
        Info: <a href={`mailto:${company.infoEmail}`}>{company.infoEmail}</a>
        <br />
        Phone: <a href={`tel:${company.phoneE164}`}>{company.phoneDisplay}</a>
        <br />
        Grievance: <a href={`mailto:${company.grievanceEmail}`}>{company.grievanceEmail}</a>
        <br />
        Privacy Policy: <Link href="/privacy">/privacy</Link>
      </p>
    </>
  );
}

export const TERMS_TOC = [
  { id: "definitions", label: "1. Definitions" },
  { id: "eligibility", label: "2. Eligibility" },
  { id: "licence", label: "3. Licence" },
  { id: "customer", label: "4. Customer terms" },
  { id: "partner", label: "5. Partner terms" },
  { id: "acceptable-use", label: "6. Acceptable use" },
  { id: "content", label: "7. Content" },
  { id: "ip", label: "8. IP" },
  { id: "third-party", label: "9. Third parties" },
  { id: "fees", label: "10. Fees" },
  { id: "disclaimers", label: "11. Disclaimers" },
  { id: "liability", label: "12. Liability" },
  { id: "indemnity", label: "13. Indemnity" },
  { id: "suspension", label: "14. Suspension" },
  { id: "privacy", label: "15. Privacy" },
  { id: "changes", label: "16. Changes" },
  { id: "law", label: "17. Governing law" },
  { id: "general", label: "18. General" },
  { id: "contact", label: "19. Contact" },
] as const;
