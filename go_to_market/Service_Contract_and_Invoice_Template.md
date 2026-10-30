# Service Contract & Invoice Template

> **Important:** This is a **template for discussion**, not legal advice. Have a Ugandan lawyer review it before either party signs. Do not send an invoice with real bank or mobile-money details until the contracting entity, TIN, and signatory authority are verified.

**Project:** Centralized Multi-Channel Order, Kitchen Display System (KDS) & Inventory Engine<br>
**Client:** Foodizo (Ham Towers) and Obunuzi Restaurant & Cafe (Opposite YMCA)<br>
**Client Lead:** Zito Mbowe (Project Coordinator â€” MRFSS Project)<br>
**Contractor:** `[CONTRACTOR LEGAL NAME]`<br>
**Jurisdiction:** Kampala, Republic of Uganda<br>
**Currency:** Ugandan Shillings (UGX)<br>
**Related Specifications:** `Foundational_Concept.md` Â· `Design_System.md` Â· `User_Flow.md` Â· `User_Profiles_Personas.md` Â· `Delivery_Zones_and_Dispatch.md` Â· `Tech_Stack.md` Â· `Payment_Integration.md` Â· `Hardware_and_Peripherals.md` Â· `Seed_Data_and_Testing.md` Â· `Repo_Scaffold_and_Config.md` Â· `Demo_Script_and_Closing_Strategy.md` Â· `Daily_Audit_Digest.md` Â· `Deployment_Runbook.md` Â · `../build_strategy/Build_Strategy_and_Phases.md`

---

## 0. Pre-Signature Checks

Complete these before sending the contract or invoice:

- [ ] Confirm the **legal name** of the client entity that will sign. â€œFoodizo,â€ â€œObunuzi,â€ and â€œMRFSS Projectâ€ may be trading names, a university project, or separate companies.
- [ ] Confirm that **Zito Mbowe** is authorised to bind the client. If not, identify the director/owner who can sign.
- [ ] Confirm the contractor's **registered business name**, TIN, and whether it is VAT-registered.
- [ ] Confirm whether **hardware** (mini-PC, router, tablets, printer, UPS, cabling) is included or supplied by the client.
- [ ] Confirm the **monthly retainer start date** and what happens in the first month.
- [ ] Confirm **support hours** and the **uptime target** the contractor can actually meet.
- [ ] Confirm **payment details** directly with the contractor's bank; do not trust an email that changes account numbers.
- [ ] Have a Ugandan lawyer review the final version.

---

## 1. Parties

This Service Agreement (â€œAgreementâ€) is made on `[DATE]` between:

**The Client**

| Field | Details |
| :--- | :--- |
| Legal name | `[CLIENT LEGAL NAME]` |
| Trading name(s) | Foodizo (Ham Towers) / Obunuzi Restaurant & Cafe (Opposite YMCA) |
| TIN | `[CLIENT TIN]` |
| Address | `[CLIENT REGISTERED ADDRESS]` |
| Signatory | `[NAME, TITLE]` |
| Email / phone | `[EMAIL]` / `[PHONE]` |

**The Contractor**

| Field | Details |
| :--- | :--- |
| Legal name | `[CONTRACTOR LEGAL NAME]` |
| TIN | `[CONTRACTOR TIN]` |
| Address | `[CONTRACTOR ADDRESS]` |
| Signatory | `[NAME, TITLE]` |
| Email / phone | `[EMAIL]` / `[PHONE]` |

The Client and the Contractor are each a â€œPartyâ€ and together the â€œParties.â€

---

## 2. Background & Scope

The Client operates two food-service outlets in Wandegeya, Kampala:

1. **Foodizo** â€” Ham Towers, Makerere Main Gate.
2. **Obunuzi Restaurant & Cafe** â€” Opposite YMCA Comprehensive Institute.

The Contractor will design, deploy, configure, train, and maintain a centralized multi-channel order, KDS, and inventory system for the outlets. The system includes:

- Customer PWA for pre-orders and pickup tokens.
- FOH POS for table orders and phone/delivery entry.
- Multi-station KDS (Steam, Fryer, Rolex, Expo).
- Delivery zone/landmark checkout, FOH dispatch queue, and printed rider chits. No live map SDK, live rider tracking, or rider app in Phase 1.
- Recipe BOM and high-turnover inventory tracking.
- MTN MoMo and Airtel Money payment integration, subject to the telcos' approval and API availability.
- End-of-day surplus logging and the 21:30 owner audit digest.
- Local edge deployment with offline LAN operation for KDS/POS/printing.

The detailed functional specification is the `docs/` package in the project repository. If there is a conflict between this Agreement and the specification, this Agreement controls commercial terms; the specification controls functionality, unless the Parties agree otherwise in writing.

---

## 3. Deliverables & Milestones

> **Delivery sequencing:**  · `build_strategy/Build_Strategy_and_Phases.md §6` maps these milestones to implementation Stage 0â€“6 and defines the evidence required at each gate. It does not change the commercial terms, fees, or acceptance rules in this Agreement.

### Milestone 1 â€” Kickoff & Environment (proposed 7 calendar days)

- Confirm scope, users, outlets, menu data, and acceptance criteria.
- Procure or receive hardware; install the edge server, UPS, router reservations, and LAN.
- Deploy PostgreSQL, Redis, Fastify API, Next.js frontend, and the KDS/POS surfaces.
- Configure backup, timezone, and local network security.
- Deliverable: staging environment reachable on the outlet LAN; signed kickoff checklist.

### Milestone 2 â€” Configuration & Integration (proposed 7 calendar days)

- Load menu, recipes/BOM, staff accounts, tables, and delivery zones.
- Configure MTN MoMo and Airtel Money sandbox/production credentials in the client's name.
- Configure ESC/POS packaging and delivery chits.
- Configure Africa's Talking SMS and the 21:30 owner digest.
- Deliverable: end-to-end test order in staging, including a paid MoMo sandbox transaction and a printed chit.

### Milestone 3 â€” Training & Go-Live (proposed 3 calendar days)

- On-site training for the three staff roles: FOH (including counter cashier duties), kitchen, and manager/admin.
- Rush-hour simulation and delivery dispatch drill.
- Go-live checklist signed by the Client.
- Deliverable: production go-live; acceptance certificate or deemed acceptance under Â§5.

### Milestone 4 â€” Monthly Maintenance

- Hosting/edge support, backup verification, telco API maintenance, security updates, and support within the retainer scope.
- Deliverable: monthly service report and the daily audit digest.

Timeline assumptions: the dates above assume the Client provides timely access, data, hardware, power, internet, and telco onboarding. Delays caused by the Client extend the timeline.

---

## 4. Client Responsibilities

The Client will:

- Provide safe access to both outlets, power, internet, and a locked space for the edge server.
- Provide or approve hardware (mini-PC, router, switch, tablets, printer, UPS, cabling) and pay for it separately unless quoted.
- Provide menu, recipe, price, staff, table, and delivery-zone data in the agreed format.
- Open and maintain MTN MoMo and Airtel Money merchant accounts in the Client's name, and complete telco KYC/approval.
- Provide a dedicated phone number for the owner digest and a monitored email address.
- Ensure staff attend training and use the system as instructed.
- Obtain any consent required for customer phone numbers and delivery data.
- Nominate one decision-maker for acceptance and change approvals.
- Pay invoices on time.

The Contractor is not responsible for telco approval delays, ISP outages, power cuts, printer hardware failure, or the Client's failure to provide data or access.

---

## 5. Acceptance

- The Client will test each milestone against the acceptance checklist in the specification.
- The Client will give written acceptance or a written punch list within **5 business days** of the Contractor's notice that a milestone is ready.
- If the Client does not respond within 5 business days, the milestone is deemed accepted, except for defects that make the system unusable.
- The Contractor will fix valid punch-list defects within a reasonable time; new requests are change requests under Â§6.
- Go-live acceptance requires: a paid test transaction, a printed KDS chit, a delivery dispatch test, a backup/restore test, and staff sign-off.

---

## 6. Fees & Payment

### 6.1 Implementation fee (proposed â€” confirm before sending)

| Item | Amount (UGX) |
| :--- | ---: |
| Multi-channel order, KDS, POS, and customer PWA implementation | 1,000,000 |
| Edge node, LAN, router, and printer configuration | 500,000 |
| Recipe BOM, inventory, and delivery-zone configuration | 500,000 |
| On-site training, rush-hour simulation, and go-live support | 500,000 |
| **Total implementation fee** | **2,500,000** |

**Payment schedule:**

- **50% deposit â€” UGX 1,250,000** on signing. Work starts after receipt.
- **50% balance â€” UGX 1,250,000** on go-live acceptance under Â§5.

### 6.2 Monthly retainer (proposed â€” confirm before sending)

- **UGX 350,000 per month**, payable in advance on the first business day of each month.
- First retainer payment is due on the first business day of the month following go-live. The go-live month is included in the implementation fee.
- Retainer includes: edge/application maintenance, backup verification, security updates, telco API version maintenance, and remote support within Â§7.
- Retainer does **not** include: new features, new outlets, hardware, on-site travel beyond the agreed visits, SMS/API pass-through costs, or support outside the agreed hours.

### 6.3 Taxes

- All amounts are exclusive of VAT and any applicable withholding tax unless stated otherwise.
- If the Contractor is VAT-registered, the Contractor will issue a tax invoice showing VAT. If not, the document is an **invoice**, not a tax invoice.
- The Client may withhold tax as required by Ugandan law and will provide the withholding certificate.
- Each Party bears its own income tax.

### 6.4 Late payment

- Overdue amounts may attract interest at **2% per month** or the maximum permitted by law, whichever is lower.
- The Contractor may suspend support or access after **14 days** of non-payment, after written notice.
- Suspension does not relieve the Client of accrued fees.

### 6.5 Hardware & expenses

- Hardware is **not included** in the implementation fee unless a signed hardware schedule or separate quotation lists it.
- If the Contractor supplies hardware, it will be invoiced at cost plus **10%** handling, or as separately quoted.
- Travel outside Kampala, additional on-site visits, and third-party fees (SMS, cloud, telco, domain) are at cost or as quoted.

---

## 7. Support & Service Levels

| Item | Commitment |
| :--- | :--- |
| Support hours | 07:00â€“22:00 EAT, 7 days per week |
| Critical incident (kitchen halted) | Initial response within **45 minutes** during support hours |
| Standard incident | Response within **1 business day** |
| On-site visits | `[NUMBER]` per month included; additional visits at `[UGX RATE]` |
| Remote support | Included within the retainer's fair-use limit of `[HOURS]` hours/month |
| Uptime target | **99.5% monthly** for the application at the edge, excluding scheduled maintenance, ISP, power, telco, third-party APIs, and customer devices |
| Maintenance window | `[DAY/TIME]`, announced at least 24 hours in advance except for emergencies |
| Backup verification | Weekly automated check; restore test quarterly |

The uptime target is a target, not a guarantee. Service credits apply only if separately agreed in writing. The Contractor is not liable for outages caused by UMEME load-shedding, ISP failures, telco API downtime, Cloudflare/Meta/Google outages, or the Client's network.

---

## 8. Change Requests

- A change request must describe the change, reason, impact on timeline, and price.
- The Contractor will estimate the change within 3 business days.
- No change is binding until both Parties approve it in writing (email is acceptable).
- Urgent security patches and dependency updates are not change requests.

---

## 9. Intellectual Property

- **Client data:** All business records, menu data, recipes, sales figures, customer phone numbers, delivery notes, and financial ledgers belong to the Client.
- **Software:** The Contractor owns the software, source code, designs, and generic components, and grants the Client a perpetual, non-exclusive, non-transferable licence to use the deployed system at the two outlets for internal business purposes.
- **Restrictions:** The Client may not resell, sublicense, or distribute the software to third parties without written consent.
- **Open source:** The software may include open-source components governed by their licences. The Contractor will not include a component that requires the Client to disclose its proprietary data.
- **Source code escrow:** Optional; if the Client requires it, the Parties will sign a separate escrow agreement and the Client will pay the escrow provider's fees.
- **Feedback:** The Client may provide feedback; the Contractor may use it to improve the product without disclosing the Client's confidential data.

---

## 10. Data Protection & Privacy

- The Client is the **data controller** for customer and staff personal data. The Contractor is a **data processor** for the limited purpose of operating the system.
- The Contractor will process personal data only on the Client's instructions and for the services in this Agreement.
- The Contractor will apply reasonable technical and organisational safeguards: access control, encrypted transport, masked logs, backups, and retention limits.
- The Contractor will notify the Client within **48 hours** of becoming aware of a personal-data breach.
- The Client is responsible for obtaining customer consent where required and for complying with the Uganda Data Protection and Privacy Act, 2019.
- The Contractor will not sell personal data or use it for marketing.
- On termination, the Contractor will return or delete personal data as instructed, subject to legal retention requirements.

---

## 11. Confidentiality

- Each Party will protect the other's confidential information and use it only for this Agreement.
- Confidential information includes pricing, customer data, source code, credentials, and business plans.
- The obligation does not apply to information that is public, independently developed, or required to be disclosed by law.
- The obligation survives termination for **3 years**, and indefinitely for personal data and trade secrets.

---

## 12. Warranties & Disclaimers

- The Contractor warrants that it has the skill and authority to perform the services and will perform them in a professional manner.
- The Contractor does not warrant that third-party telco, SMS, Cloudflare, Meta, Google, or payment services will be uninterrupted or error-free.
- The system is not a substitute for the Client's own accounting, tax, food-safety, or legal compliance.
- Except as expressly stated, the Contractor disclaims all other warranties, including fitness for a particular purpose, to the maximum extent permitted by law.

---

## 13. Limitation of Liability

- The Contractor's total liability under this Agreement is limited to the fees paid by the Client in the **12 months** before the claim.
- Neither Party is liable for indirect, incidental, special, or consequential damages, loss of profit, or loss of goodwill.
- The limitation does not apply to wilful misconduct, fraud, breach of confidentiality, or a Party's indemnity obligations.
- The Contractor operates the automated database backup and weekly verification described in Â§7, and performs the quarterly restore test. The Client must not delete or overwrite production data, must report suspected data loss promptly, and should retain its own exported copies of critical accounting records. The Client remains responsible for verifying that the system meets its tax and regulatory obligations.

---

## 14. Term & Termination

- This Agreement starts on the signing date and continues until the implementation is accepted.
- The monthly retainer starts on the date in Â§6.2 and continues for an initial term of **12 months**, then renews monthly unless terminated with **30 days' written notice**.
- Either Party may terminate for material breach if the breach is not cured within **14 days** of written notice.
- The Contractor may terminate or suspend for non-payment under Â§6.4.
- On termination, the Client will pay for work performed and approved expenses; the Contractor will provide reasonable transition assistance at its then-current rates.
- Clauses on IP, confidentiality, data protection, liability, and dispute resolution survive termination.

---

## 15. Force Majeure

Neither Party is liable for delay or failure caused by events beyond its reasonable control, including power outages, ISP failure, telco outages, government action, civil unrest, fire, flood, or epidemic. The affected Party will notify the other promptly and use reasonable efforts to resume performance.

---

## 16. Dispute Resolution & Governing Law

- The Parties will first attempt to resolve any dispute by good-faith negotiation within **14 days**.
- If negotiation fails, the Parties will attempt mediation in Kampala.
- If mediation fails, the dispute will be resolved by the courts of Uganda.
- This Agreement is governed by the laws of the Republic of Uganda.

---

## 17. General

- **Entire agreement:** This Agreement and its annexes are the entire agreement and supersede prior discussions.
- **Amendments:** Must be in writing and signed by both Parties.
- **Notices:** Email to the addresses in Â§1 is sufficient unless the Agreement requires a signed document.
- **Assignment:** Neither Party may assign without the other's written consent, except to an affiliate on notice.
- **Severability:** If a clause is unenforceable, the rest remains in effect.
- **No partnership:** The Parties are independent contractors.
- **Counterparts:** This Agreement may be signed in counterparts and by electronic signature.

---

## 18. Signatures

**For the Client**

| | |
| :--- | :--- |
| Signature | ________________________________ |
| Name | `[NAME]` |
| Title | `[TITLE]` |
| Date | ________________________________ |

**For the Contractor**

| | |
| :--- | :--- |
| Signature | ________________________________ |
| Name | `[NAME]` |
| Title | `[TITLE]` |
| Date | ________________________________ |

**Witness (optional)**

| | |
| :--- | :--- |
| Signature | ________________________________ |
| Name | `[NAME]` |
| Date | ________________________________ |

---

## Annex A â€” Invoice Template

> Use â€œTax Invoiceâ€ only if the Contractor is VAT-registered. Otherwise use â€œInvoice.â€ Replace every bracketed placeholder before sending. Verify bank/mobile-money details by phone; never change them based on an email alone.

```text
===================================================================================
                                [TAX] INVOICE
===================================================================================
INVOICE NUMBER:   INV-[YEAR]-[SEQUENCE]
DATE OF ISSUE:    [DATE]
PAYMENT DUE:      [DATE] (Milestone 1 deposit) / [DATE] (balance)

FROM:
[CONTRACTOR LEGAL NAME]
TIN: [CONTRACTOR TIN]
Address: [CONTRACTOR ADDRESS]
Email: [EMAIL] | Phone: [PHONE]

BILLED TO:
Attention:        [CLIENT CONTACT NAME, TITLE]
Organization:     [CLIENT LEGAL NAME]
Trading as:       Foodizo (Ham Towers) / Obunuzi (Opposite YMCA)
TIN:              [CLIENT TIN]
Address:          [CLIENT ADDRESS]
Email:            [CLIENT EMAIL] | Phone: [CLIENT PHONE]

-----------------------------------------------------------------------------------
ITEM  DESCRIPTION                                       QTY   RATE (UGX)    TOTAL (UGX)
-----------------------------------------------------------------------------------
01    Multi-channel order, KDS, POS & customer PWA        1    1,000,000     1,000,000
02    Edge node, LAN, router & printer configuration      1      500,000       500,000
03    Recipe BOM, inventory & delivery-zone setup         1      500,000       500,000
04    On-site training, rush-hour test & go-live          1      500,000       500,000
-----------------------------------------------------------------------------------
SUBTOTAL:                                                                  2,500,000
VAT [18% / 0% / not registered]:                                           [AMOUNT]
WITHHOLDING TAX [IF APPLICABLE]:                                          [AMOUNT]
-----------------------------------------------------------------------------------
TOTAL DUE:                                                                 [AMOUNT]
MILESTONE 1 DEPOSIT (50%):                                                 1,250,000
BALANCE ON GO-LIVE (50%):                                                  1,250,000
-----------------------------------------------------------------------------------

PAYMENT INSTRUCTIONS (VERIFY BY PHONE BEFORE TRANSFERRING):
Bank name:        [BANK NAME]
Account name:     [ACCOUNT NAME]
Account number:   [ACCOUNT NUMBER]
Branch:           [BRANCH]
Reference:        INV-[YEAR]-[SEQUENCE]

Mobile money (optional):
MTN merchant code:    [CODE]  (dial *165*3#)
Airtel merchant code: [CODE]  (dial *185*9#)
Reference:            INV-[YEAR]-[SEQUENCE]

NOTES:
- Hardware is excluded unless listed in a separate quotation.
- Monthly retainer is invoiced separately under the Service Agreement.
- Please send proof of payment to [EMAIL].
===================================================================================
```

---

## Annex B â€” Commercial Summary (for the meeting)

| Item | Proposed amount |
| :--- | ---: |
| Implementation (one-time) | UGX 2,500,000 |
| Deposit on signing (50%) | UGX 1,250,000 |
| Balance on go-live (50%) | UGX 1,250,000 |
| Monthly retainer | UGX 350,000 / month |
| Hardware | Excluded unless quoted |

**Positioning:** The implementation fee covers configuration, deployment, training, and go-live. The retainer covers maintenance and support. Hardware, SMS/API usage, and telco fees are separate so the client can see exactly what is being paid for.

**Do not promise:** â€œzero operating cost,â€ â€œ99.9% uptime,â€ â€œ24/7 support,â€ â€œguaranteed telco approval,â€ or â€œzero theft.â€ Promise only what the specification and this Agreement actually commit to.
