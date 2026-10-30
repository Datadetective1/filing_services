import type { EntityType } from "@/lib/domain/types";
import type {
  ChangeOfAgentFacts,
  ProviderCoverage,
  RaSource,
} from "./jurisdictions";

/**
 * Verified jurisdiction facts, researched October 29, 2026 from each jurisdiction's own filing
 * office site (Secretary of State, Division of Corporations or equivalent) or its official
 * statutes. Every fact carries its source URL, a verbatim quote and the date checked. A fact
 * that could not be confirmed is absent and explained in `unverified`. Corporation formation
 * fees that rise with authorized shares, or that need extra filings or publication, are left
 * out on purpose so a formation quote is never a guess.
 *
 * Provider coverage: the jurisdiction's page on Registered Agents Inc.'s own website.
 */

export interface StateFacts {
  change: ChangeOfAgentFacts | null;
  appointment: { text: string; sources: RaSource[] } | null;
  formation: {
    governmentFeeCents: Partial<Record<EntityType, number>>;
    sources: RaSource[];
  } | null;
  provider: RaSource | null;
  providerCoverage?: ProviderCoverage;
  notes: string[];
  unverified: string[];
  stateBlockers: string[];
  formationBlockers?: string[];
}

export const STATE_FACTS: Record<string, StateFacts> = {
  AK: {
    change: {
      formName: "Change of Registered Agent (Statement of Change), Form 08-409",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.commerce.alaska.gov/web/Portals/5/pub/corp409.pdf",
          publisher:
            "State of Alaska, Department of Commerce, Community, and Economic Development, Division of Corporations, Business and Professional Licensing, Corporations Section",
          quote: "Nonrefundable Filing Fee $25.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.commerce.alaska.gov/web/cbpl/Corporations/CorporationFormsFees",
          publisher:
            "State of Alaska, Division of Corporations, Business and Professional Licensing, Corporations Section",
          quote:
            "Change of Registered Agent (Statement of Change) - All Entity Types (Except Religious Corporation)",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in Article 3 (Registered Agent Information) of the Articles of Organization (LLC, Form 08-0484) or Articles of Incorporation (business corporation, Form 08-0400) filed to form the entity.",
      sources: [
        {
          url: "https://www.commerce.alaska.gov/web/Portals/5/pub/corp0484.pdf",
          publisher:
            "State of Alaska, Division of Corporations, Business and Professional Licensing, Corporations Section",
          quote: "ARTICLE 3 Registered Agent Information",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.commerce.alaska.gov/web/Portals/5/pub/corp0400.pdf",
          publisher:
            "State of Alaska, Division of Corporations, Business and Professional Licensing, Corporations Section",
          quote: "ARTICLE 3 Registered Agent Information",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 25000,
        corporation: 25000,
      },
      sources: [
        {
          url: "https://www.commerce.alaska.gov/web/Portals/5/pub/corp0484.pdf",
          publisher:
            "State of Alaska, Division of Corporations, Business and Professional Licensing, Corporations Section",
          quote: "Nonrefundable Filing Fee $250.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.commerce.alaska.gov/web/Portals/5/pub/corp0400.pdf",
          publisher:
            "State of Alaska, Division of Corporations, Business and Professional Licensing, Corporations Section",
          quote: "Required Fees: Nonrefundable Filing Fee $250.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/alaska/",
      publisher: "Registered Agents Inc.",
      quote:
        "Alaska Registered Agent ... your new registered agent address in Alaska is immediately available to use on filings and for correspondence.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Form 08-409 covers all entity types except religious corporations (separate form 08-543); the forms page lists it at $25.00 for both domestic LLCs and domestic business corporations, PDF only, no online option.",
      "Form 08-409 has no agent consent box; corporations need a board resolution authorizing the change.",
      "The agent must be in Alaska and cannot be out of state, per the LLC articles form.",
      "The forms page lists one fee per form; online and paper fees are the same.",
    ],
    unverified: [
      "change.consentRequired: Form 08-409 has no consent statement or agent signature line, but no official page states outright that consent is not required.",
    ],
    stateBlockers: [],
  },
  AL: {
    change: {
      formName: "Change of Registered Agent or Registered Office by Entity",
      governmentFeeCents: {
        llc: 10000,
        corporation: 10000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.alabama.gov/sites/default/files/2022-09/ChangeRegisteredAgent.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote:
            "The new registered agent must sign the consent to appointment in the consent box prior to filing.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.alabama.gov/sites/default/files/2022-09/ChangeRegisteredAgent.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote: "$100.00 Agent/Address Change filing fee",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.Sos.Alabama.Gov/sites/default/files/2022-01/2021FeeSchedule.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote: "Agent Changes $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.alabama.gov/sites/default/files/Business-Entities/Domestic%20Business%20Entities%20Brochure%202022.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote:
            "You will need to fill out a Change of Registered Agent or Registered Office by Entity form (to change the agent)",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent and registered office are named in the Certificate of Formation (LLC) or Certificate of Incorporation (business corporation) filed with the Secretary of State to form the entity.",
      sources: [
        {
          url: "https://www.sos.alabama.gov/sites/default/files/2026-03/DomesticLLCFormation.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote: "3. The name of the registered agent (only one agent):",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.alabama.gov/sites/default/files/2022-09/DomesticBusinessCorporationFormation.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote: "4. The name of the registered agent (only one agent):",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 20000,
        corporation: 20000,
      },
      sources: [
        {
          url: "https://www.Sos.Alabama.Gov/sites/default/files/2022-01/2021FeeSchedule.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote: "Certificate of Formation $200.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.alabama.gov/sites/default/files/2026-03/DomesticLLCFormation.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote:
            "Include a check, money order, or credit card payment for the $200.00 processing fee.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.alabama.gov/sites/default/files/2022-09/DomesticBusinessCorporationFormation.pdf",
          publisher: "Alabama Secretary of State, Business Entities Division",
          quote:
            "Include a check, money order, or credit card payment for the $200.00 processing fee.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/alabama/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc to be your registered agent in Alabama, we handle all your important documents.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "One change form per Entity ID number; the same $100 form covers LLCs and corporations (the 2021 fee schedule lists Agent Changes under all entity types, domestic and foreign).",
      "The new agent signs a consent box on the change form itself; no separate consent form.",
      "A change of agent cannot be made on an amendment form, per the SOS brochure.",
      "Formation also requires a name reservation before filing the Certificate of Formation, per the SOS brochure.",
      "An older corporation form on the SOS site (form-files/dbc-certificateFormation.pdf) still shows a $100 fee; the 2021 fee schedule and the 10/2022 form show $200, which is used here.",
      "Fees are the state paper fees; any online card convenience fee was not checked.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  AR: {
    change: {
      formName:
        'Notice of Change of Registered Agent Information (Form DO-03); listed as "Notice of Change of Registered Agent" for corporations and "Notice of Change of Registered Agent for LLC" for LLCs',
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.sos.arkansas.gov/business-commercial-services-bcs/forms-fees/llc/",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote:
            "Notice of Change of Registered Agent for LLC | DO-03 | No Fee | No Fee",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.arkansas.gov/business-commercial-services-bcs/forms-fees/corporations",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote:
            "Notice of Change of Registered Agent | DO-03 | No Fee | No Fee",
          checkedAt: "2026-10-29",
        },
        {
          url: "http://www.sos.arkansas.gov/uploads/bcs/CHRA_1.pdf",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote: "NOTICE OF CHANGE OF REGISTERED AGENT INFORMATION",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.arkansas.gov/uploads/LLC_Fees1.pdf",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote: "5. Statement of change of registered agent No Fee",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in item 3 of the Certificate of Organization (LLC, Form LL-01) or the Articles of Incorporation (business corporation, Form DN-01) filed to form the entity.",
      sources: [
        {
          url: "http://www.sos.arkansas.gov/uploads/bcs/LL-01_1.pdf",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote:
            "3. The name and address of the registered agent of this company shall be:",
          checkedAt: "2026-10-29",
        },
        {
          url: "http://www.sos.arkansas.gov/uploads/bcs/DN-01_1.pdf",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote: "The name and street address of initial registered agent:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 4500,
        corporation: 4500,
      },
      sources: [
        {
          url: "https://www.sos.arkansas.gov/business-commercial-services-bcs/forms-fees/llc/",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote:
            "Certificate of Organization for a Dom. Limited Liability Co. | LL-01 | $45.00 | $50.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.arkansas.gov/business-commercial-services-bcs/forms-fees/corporations",
          publisher:
            "Arkansas Secretary of State, Business and Commercial Services",
          quote: "Articles of Incorporation | DN-01 | $45.00 | $50.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/arkansas/",
      publisher: "Registered Agents Inc.",
      quote:
        "Arkansas Registered Agent ... Hire us as your registered agent, you can use our address on state filings whenever possible.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Formation fees differ: $45.00 online, $50.00 paper, for both LLC (LL-01) and corporation (DN-01). The online fee is used above.",
      "The change of agent filing is free online and on paper; one form (DO-03, Rev. 1/25) covers LLCs, corporations and other entity types and can be filed online.",
      "The DO-03 form has no consent box or signature line for the new agent; only an authorized officer of the entity signs.",
      "A change of principal office address is a separate free notice.",
    ],
    unverified: [
      "change.consentRequired: Form DO-03 has no agent consent statement or agent signature, but no official page states outright that consent is not required.",
    ],
    stateBlockers: [],
  },
  AZ: {
    change: {
      formName:
        "LLC: LLC Statement of Change of Principal Address or Statutory Agent (Form L020); corporation: Statement of Change (Form C016); plus Statutory Agent Acceptance (Form M002) signed by the new agent",
      governmentFeeCents: {
        llc: 500,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://azcc.gov/docs/default-source/corps-files/fee-schedules/fee-schedule-llcs.pdf",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote:
            "LLC Statement of Change of Principal Address or Statutory Agent $5.00 $40.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.azcc.gov/docs/default-source/corps-files/fee-schedules/fee-schedule-corporations6def4cc74b1a47129d16c2b1c3851bda.pdf",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote:
            "Statement of Change to Known Place of Business, Principal Address or Statutory Agent No Fee $35.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://azcc.gov/docs/default-source/corps-files/instructions/l020i-instructions-statement-of-change-address-agent.pdf?sfvrsn=d7beaa0e_4",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote: "The filing fee is $5.00.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://azcc.gov/docs/default-source/corps-files/instructions/c016i-instructions-statement-of-change.pdf?sfvrsn=fdaeb7ff_4",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote:
            "There is no filing fee for a corporation Statement of Change.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://azcc.gov/docs/default-source/corps-files/instructions/m002i-instructions-statutory-agent-acceptance.pdf?sfvrsn=7f07b36f_2",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote: "The statutory agent must accept the appointment in writing.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://azcc.gov/docs/default-source/corps-files/instructions/l020i-instructions-statement-of-change-address-agent.pdf?sfvrsn=d7beaa0e_4",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote:
            "Statutory Agent Acceptance, if a new agent is being appointed",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The statutory agent is named in the Articles of Organization (LLC, Form L010, item 4.1) or Articles of Incorporation (for-profit corporation, Form C010, item 8.1) filed to form the entity, with a signed Statutory Agent Acceptance (Form M002) on file.",
      sources: [
        {
          url: "https://azcc.gov/docs/default-source/corps-files/instructions/l010i-instructions-articles-of-organization.pdf",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote:
            "List the name of the statutory agent - either an individual or entity, not both.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://azcc.gov/docs/default-source/corps-files/instructions/c010i-instructions-articles-of-inc-for-profit.pdf",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote:
            "List the name of the statutory agent - either an individual or entity, not both.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://azcc.gov/docs/default-source/corps-files/instructions/m002i-instructions-statutory-agent-acceptance.pdf?sfvrsn=7f07b36f_2",
          publisher: "Arizona Corporation Commission, Corporations Division",
          quote:
            "the Acceptance be submitted simultaneously with whatever other document makes the appointment",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: null,
    provider: {
      url: "https://www.registeredagentsinc.com/arizona/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your statutory agent in Arizona",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Arizona calls the registered agent a statutory agent.",
      "Fee schedule columns are regular then expedited; the expedited amounts ($40 LLC change, $35 corporation change, $85 LLC articles, $95 corporation articles) are not the standard fees.",
      "A Statement of Change naming a new agent is rejected if no Statutory Agent Acceptance (Form M002) is in the ACC system when it is examined; the new agent may file M002 separately, but the ACC recommends filing it at the same time.",
      "Same acceptance rule applies at formation: Articles are rejected if no acceptance is on file when examined.",
      "Statutory Agent Resignation is a separate $10.00 filing by the agent, not the entity's change filing.",
    ],
    unverified: [
      "Arizona may require publishing the articles depending on county; not checked.",
      "Arizona may require publishing the articles depending on county; not checked.",
    ],
    stateBlockers: [],
  },
  CA: {
    change: {
      formName:
        "Statement of Information: Form LLC-12 (Limited Liability Company) or Form SI-550 (California Stock, Agricultural Cooperative and Foreign Corporations), filed online at bizfile Online or on paper",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.sos.ca.gov/business-programs/business-entities/faqs",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "File online at bizfileOnline.sos.ca.gov the Statement of Information - CA and Out-of-State LLC.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ca.gov/business-programs/business-entities/faqs",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "File online at bizfileOnline.sos.ca.gov the Statement of Information - CA and Out-of-State Corporation.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bpd.cdn.sos.ca.gov/llc/forms/llc-12-112021.pdf",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "to update information including changes to the agent for service of process",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bpd.cdn.sos.ca.gov/pdf/be-fee-schedule-062018.pdf",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "Submission of a statement between applicable filing periods to report a change of information",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?amp=&lawCode=GOV&sectionNum=12186.",
          publisher:
            "California Legislative Information, Government Code § 12186 (Secretary of State corporate filing fees)",
          quote:
            "(i) Filing changes to any statement of information subject to subdivisions (g) and (h): No fee.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?amp=&lawCode=GOV&sectionNum=12186.",
          publisher:
            "California Legislative Information, Government Code § 12186",
          quote:
            "(g) Filing the statement of information for every corporation pursuant to Sections 1502, 6210, 8210, 9660, and 12570 of the Corporations Code and Section 14101.6 of the Financial Code: Twenty dollars ($20).",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1502.&lawCode=CORP",
          publisher:
            "California Legislative Information, Corporations Code § 1502",
          quote:
            "In order to change its agent for service of process or the address of the agent, the corporation must file a current statement containing all the information required by subdivisions (a) and (b).",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1502.&lawCode=CORP",
          publisher:
            "California Legislative Information, Corporations Code § 1502",
          quote:
            "(i) In addition to any other fees required, a corporation shall pay a five-dollar ($5) disclosure fee when filing the statement required by subdivision (a).",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ca.gov/business-programs/business-entities/forms/corporations-statement-information",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "Statement of Information - Domestic and Foreign Stock (Form SI-550) $25.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ca.gov/business-programs/business-entities/statements",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "any time there are information changes in between statutory filing periods, an updated statement should be filed.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The agent for service of process is named in item 3 (Service of Process) of the Articles of Organization (LLC, Form LLC-1) or the Articles of Incorporation of a General Stock Corporation (Form ARTS-GS) filed to form the entity.",
      sources: [
        {
          url: "https://bpd.cdn.sos.ca.gov/llc/forms/llc-1.pdf",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "3. Service of Process (Must provide either Individual OR Corporation.)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bpd.cdn.sos.ca.gov/corp/pdf/articles/arts-gs.pdf",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote:
            "3. Service of Process (Must provide either Individual OR Corporation.)",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 7000,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://bpd.cdn.sos.ca.gov/llc/forms/llc-1.pdf",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote: "Filing Fee - $70.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bpd.cdn.sos.ca.gov/corp/pdf/articles/arts-gs.pdf",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote: "Filing Fee - $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ca.gov/business-programs/business-entities/forms/limited-liability-companies-california-domestic",
          publisher:
            "California Secretary of State, Business Programs Division",
          quote: "Formation - Articles of Organization",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/california/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is a serious contender in the realm of California corporate registered agents.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "California calls the registered agent the agent for service of process; there is no separate change of agent form. The entity files an updated Statement of Information.",
      "An update filed after the initial or required periodic filing has been met is No Fee (LLC-12 form fee table; 2018 fee schedule lists the between periods update as NO FEE for California corporations and LLCs). If the change is made on the initial or required periodic Statement of Information instead, that filing carries its normal fee ($20.00 LLC-12; $25.00 SI-550 including the $5 disclosure fee).",
      "The 2018 fee schedule names the corporation form SI-200, since replaced by SI-550; the SI-550 form itself lists only the $25.00 fee and does not state the no fee update rule.",
      "A California registered corporate agent (Section 1505 corporation) must give advance approval before an entity designates it as agent, per the LLC-12 form and the SOS FAQ; no consent form is required for an individual agent.",
      "Formation fees are the same online (bizfile Online) and on paper; online is faster (5 days or less vs 10+ days for PDF forms). Paper in person submissions add a $15 special handling fee.",
      "Resolved: a corporation that changes its agent for service of process with an updated Statement of Information (SI-550) filed between its required filing periods pays no filing fee. Government Code § 12186(i) (amended Stats. 2011, ch. 204, effective January 1, 2012) sets No fee for filing changes to a corporation statement of information. This is the current statute and agrees with the SOS 2018 fee schedule used in the main CA.json.",
      "The SOS forms page lists SI-550 at $25.00; that is the required periodic filing ($20 under § 12186(g) plus the $5 disclosure fee of Corporations Code § 1502(i)). The $5 disclosure fee is tied to the statement required by subdivision (a) (the periodic filing); no official page loaded says whether bizfile charges it on an off cycle update, so treat the update as $0 by statute and confirm in bizfile if needed.",
      "Corporations Code § 1502(e) makes the updated statement the only way to change the agent: a filed statement supersedes the agent named in the articles.",
    ],
    unverified: [
      "change.consentRequired: official pages require advance approval only when a registered corporate agent is designated; nothing states consent for an individual agent, so left null.",
      "change.corpFeeCents: no official page says whether bizfile Online adds the $5 disclosure fee to an update filed between periodic filings; the statute (Gov. Code § 12186(i)) says no fee.",
    ],
    stateBlockers: [],
  },
  CO: {
    change: {
      formName: "Statement of Change Changing the Registered Agent Information",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.state.co.us/pubs/info_center/fees/business.html",
          publisher: "Colorado Secretary of State",
          quote:
            "Statement of Change Changing the Registered Agent Information | $10.00 | n/a",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.co.us/pubs/business/helpFiles/CHANGE_RA_HELP.html",
          publisher: "Colorado Secretary of State",
          quote:
            "The registered agent must consent to being appointed as the registered agent for the entity.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC) or Articles of Incorporation (profit corporation) filed online to form the entity, and the filer must check a box affirming the agent has consented to the appointment.",
      sources: [
        {
          url: "https://www.sos.state.co.us/pubs/business/helpFiles/ARTORG_LLC_HELP.html",
          publisher: "Colorado Secretary of State",
          quote: "Provide the name of the registered agent.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.co.us/pubs/business/helpFiles/ARTORG_LLC_HELP.html",
          publisher: "Colorado Secretary of State",
          quote:
            "The registered agent must consent to being appointed as the registered agent for the entity.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.co.us/pubs/business/helpFiles/ARTINC_PC_HELP.html",
          publisher: "Colorado Secretary of State",
          quote:
            "The statement regarding registered agent consent is required.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5000,
        corporation: 5000,
      },
      sources: [
        {
          url: "https://www.sos.state.co.us/pubs/info_center/fees/business.html",
          publisher: "Colorado Secretary of State",
          quote: "Articles of Organization | $50.00 | n/a",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.co.us/pubs/info_center/fees/business.html",
          publisher: "Colorado Secretary of State",
          quote: "Articles of Incorporation | $50.00 | n/a",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/colorado/",
      publisher: "Registered Agents Inc.",
      quote:
        "Colorado Registered Agent ... your new registered agent address in Colorado is immediately available to use on filings",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The fee schedule lists these fees in the Online fee column with n/a under Paper fee: these filings are made online only.",
      "The change of agent fee sits under the Business Transactions, General applicability table, so the same $10.00 applies to LLCs and corporations.",
      "Consent is affirmed by checking a box on the online form; no separate consent document is filed.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  CT: {
    change: {
      formName:
        "Change of Agent, Domestic (formed in Connecticut), Form BUS-09 (Change of Agent, Domestic Entities except LPs); also filed online at business.ct.gov",
      governmentFeeCents: {
        llc: 5000,
        corporation: 5000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://portal.ct.gov/-/media/SOTS/Business-Services/BSD-Forms/llc-2017/CHANGE-OF-AGENT-DOMESTIC-FORMED-IN-CT-ALL-ENTITIES-112010.pdf?la=en",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "Filing Fee: $50",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://portal.ct.gov/-/media/SOTS/Business-Services/BSD-Forms/llc-2017/CHANGE-OF-AGENT-DOMESTIC-FORMED-IN-CT-ALL-ENTITIES-112010.pdf?la=en",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "Signature Accepting Appointment:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://business.ct.gov/knowledge-base/articles/change-forms-already-submitted-to-ct",
          publisher:
            "State of Connecticut, CT Business One Stop (Secretary of the State)",
          quote: "The fee is $50 for all other business entities.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://portal.ct.gov/-/media/sots/business-services/bsd-forms/fee-schedule-revised-712020.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "H. Change of Agent 50",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://portal.ct.gov/-/media/sots/business-services/bsd-forms/fee-schedule-revised-712020.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "L. Change of Agent 50",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is appointed in the Certificate of Organization (LLC, item 4) or Certificate of Incorporation (stock corporation, item 6) filed to form the entity, and the agent signs that form accepting the appointment.",
      sources: [
        {
          url: "https://portal.ct.gov/-/media/sots/business-services/bsd-forms/limited-liability-company/domestic/cert-of-organization-llc-domestic-2020-final-version.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "4. APPOINTMENT OF REGISTERED AGENT (required):",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://business.ct.gov/-/media/BusinessOneStop/BRS-Forms/Corporation-Forms/Cert-of-Incorporation-Stock-Corp-2020r11aFILLABLE-430.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "6. APPOINTMENT OF REGISTERED AGENT (required)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://portal.ct.gov/-/media/sots/business-services/bsd-forms/fee-schedule-revised-712020.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote:
            "C. Certificate of Organization (Including Appointment of Statutory Agent) 120",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 12000,
      },
      sources: [
        {
          url: "https://portal.ct.gov/-/media/sots/business-services/bsd-forms/limited-liability-company/domestic/cert-of-organization-llc-domestic-2020-final-version.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "FILING FEE: $120",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://business.ct.gov/-/media/BusinessOneStop/BRS-Forms/Corporation-Forms/Cert-of-Incorporation-Stock-Corp-2020r11aFILLABLE-430.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "Includes franchise tax up to 20,000 shares.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://portal.ct.gov/-/media/sots/business-services/bsd-forms/fee-schedule-revised-712020.pdf",
          publisher:
            "Secretary of the State of Connecticut, Business Services Division",
          quote: "D. Certificate of Incorporation 250",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/connecticut/",
      publisher: "Registered Agents Inc.",
      quote:
        "we can act as your registered agent whether you stay in Connecticut",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The corporation formation fee of $250 includes the minimum franchise tax for corporations authorizing up to 20,000 shares; more authorized shares raise the amount due.",
      "The new agent must sign the change form (Signature Accepting Appointment) for both individual and business agents.",
      "Change of Agent and formation filings can be made online at business.ct.gov; the domestic stock corporation fee page lists the online fees as $50 (Change of Agent) and $250 (Certificate of Incorporation), the same as paper.",
      "Nonstock (nonprofit) corporations pay $20 for a change of agent, not relevant to LLCs or stock corporations.",
      "A change of the agent's address is a separate $50 filing on the fee schedule.",
    ],
    unverified: [
      "Corporation formation fee includes a franchise tax that rises with authorized shares.",
    ],
    stateBlockers: [],
  },
  DC: {
    change: {
      formName: "Statement of Change of Registered Agent (Form RA-3)",
      governmentFeeCents: {
        llc: 5000,
        corporation: 5000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://dlcp.dc.gov/sites/default/files/dc/sites/DLCP/publication/attachments/Registered%20Agent%20Combined%20Form%20RA-1-7.pdf",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote: "Statement of Change of Registered Agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dlcp.dc.gov/sites/default/files/dc/sites/DLCP/publication/attachments/Registered%20Agent%20Combined%20Form%20RA-1-7.pdf",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote:
            "an affirmation under § 29-102.09 by the represented entity that the agent has consented to serve",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dlcp.dc.gov/node/1621921",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote:
            "Domestic & Foreign Limited Liability Company | Change of registered agent by entity | $50.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dlcp.dc.gov/node/1621906",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote:
            "Domestic & Foreign Business Corporation | Change of registered agent by entity | $50.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in item 3 of the Articles of Organization (LLC, Form DLC-1) or Articles of Incorporation (for-profit corporation, Form DBU-1) filed to form the entity.",
      sources: [
        {
          url: "https://dlcp.dc.gov/sites/default/files/dc/sites/DLCP/publication/attachments/DLC-1 Articles of Organization for Domestic Limited Liability Company.pdf",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote:
            "Registered agent's name and address in the District of Columbia.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dlcp.dc.gov/sites/default/files/dc/sites/DLCP/publication/attachments/DBU-1%20Articles%20of%20Incorporation%20of%20Domestic%20Business%20Corporation.pdf",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote:
            "3. Registered Agent's name and address in the District Columbia.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 9900,
        corporation: 9900,
      },
      sources: [
        {
          url: "https://dlcp.dc.gov/node/1621921",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote:
            "Domestic Limited Liability Company | Certificate of organization | $99.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dlcp.dc.gov/node/1621906",
          publisher:
            "District of Columbia Department of Licensing and Consumer Protection, Corporations Division",
          quote:
            "Filing articles of incorporation for a corporation with authorized capital up to one hundred thousand dollars ($100,000) | $99.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/district-of-columbia/",
      publisher: "Registered Agents Inc.",
      quote:
        "Every line of our Registered Agent service comes with built-in Renewal Service to help maintain your good standing in DC.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Corporation formation fee of $99.00 applies to authorized capital up to $100,000; it rises to $550.00 (up to $500,000), $1,100.00 (up to $1,000,000) and $1,650.00 (over $1,000,000).",
      "The change fee is listed as $50.00 on both the LLC and business corporation fee pages; the corporation row is under Domestic & Foreign Business Corporation.",
      "Form RA-3 has no separate signature line for the new agent; filing it is the entity's affirmation that the agent consented to serve.",
      "The fee pages list one fee per filing with no online vs paper split; online filing is through the BOSS portal (formerly CorpOnline) and is paid by credit card. Walk-in filings add a $100 one day expedite fee.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  DE: {
    change: {
      formName:
        "Corporation: Certificate of Change of Registered Agent and/or Registered Office; LLC: Certificate of Amendment Changing Only the Registered Office or Registered Agent of a Limited Liability Company",
      governmentFeeCents: {
        llc: 5000,
        corporation: 5000,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote: "Change of Agent/Office $50.00 $50.00 $200.00 $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote:
            "Change of Agent Only Amendment - domestic/foreign $50.00 $50.00 $200.00 $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://corpfiles.delaware.gov/corp-coa09.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote:
            "CERTIFICATE OF CHANGE OF REGISTERED AGENT AND/OR REGISTERED OFFICE",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://corpfiles.delaware.gov/corp-coa09.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote:
            "The fee to file the Certificate is $50.00 ($5.00 for non-profit corporations).",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://corpfiles.delaware.gov/LLC_Forms/LLCAmendCOA.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote:
            "CERTIFICATE OF AMENDMENT CHANGING ONLY THE REGISTERED OFFICE OR REGISTERED AGENT OF A LIMITED LIABILITY COMPANY",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://corpfiles.delaware.gov/LLC_Forms/LLCAmendCOA.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote: "The fee to file the Certificate is $50.00.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent and registered office are named in the Certificate of Formation (LLC, item 2) or the Certificate of Incorporation (stock corporation, Article Second) filed to form the entity.",
      sources: [
        {
          url: "https://corpfiles.delaware.gov/LLC_Forms/LLC%20Formation.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote:
            "The name of the Registered Agent at such address upon whom process against this limited liability company may be served is",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://corpfiles.delaware.gov/incstk.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote: "The registered agent in charge thereof is",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 11000,
      },
      sources: [
        {
          url: "https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote: "Formation - domestic $110.00 $50.00 $100.00 $50.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://corpfiles.delaware.gov/Fee_Schedule/AugustFee2026.pdf",
          publisher: "Delaware Department of State, Division of Corporations",
          quote:
            "Incorporation (including Public Benefit Corporations) *$109.00 $50.00 $100.00 $50.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/delaware/",
      publisher: "Registered Agents Inc.",
      quote:
        "We provide premium registered agent service in Delaware with annual report filing included for only $200 a year.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Fee schedule revised August 1, 2026; column order is State Filing Fee, Certified Copy (each), Same Day Fee, 24 Hour Fee. Only the first column is the standard filing fee.",
      "The corporation incorporation fee of $109.00 is a minimum: it is marked *VARIES BASED ON STOCK and covers a one page document; add $9 per additional page for county recording.",
      "The LLC formation fee of $110.00 equals filing fee plus municipality fee; extra municipality fees apply if registered agents are in different municipalities.",
      "Neither change form has an agent consent block; the corporation form is signed by an authorized officer and states the change was adopted by board resolution, and the LLC form is signed by an authorized person.",
      "Non-profit or exempt corporations pay $5.00 for a change of agent; not relevant to for-profit corporations.",
      "A general LLC Certificate of Amendment is $220.00; the change of agent only amendment is $50.00.",
    ],
    unverified: [
      "change.consentRequired: neither official change form has an agent consent statement or agent signature, but no official page states outright that consent is not required.",
      "Corporation formation fee varies with stock and page count.",
    ],
    stateBlockers: [],
  },
  FL: {
    change: {
      formName:
        "LLC: Statement of Change of Registered Office or Registered Agent or Both for Limited Liability Company; Corporation: Statement of Change of Registered Office or Registered Agent or Both for Corporations (CR2E045)",
      governmentFeeCents: {
        llc: 2500,
        corporation: 3500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://dos.fl.gov/sunbiz/forms/fees/llc-fees/",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote: "Change of Registered Agent | $ 25.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://form.sunbiz.org/pdf/inhs18.pdf",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote:
            "STATEMENT OF CHANGE OF REGISTERED OFFICE OR REGISTERED AGENT OR BOTH FOR LIMITED LIABILITY COMPANY ... FILING FEE: $25.00 ... I hereby accept the appointment as registered agent and agree to act in this capacity.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.fl.gov/sunbiz/forms/fees/corporate-fees/",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote: "Change of registered agent | $ 35.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.fl.gov/media/702435/cr2e045-12062019.pdf",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote:
            "STATEMENT OF CHANGE OF REGISTERED OFFICE OR REGISTERED AGENT OR BOTH FOR CORPORATIONS ... FILING FEE: $35.00 ... I hereby accept the appointment as registered agent and agree to act in this capacity.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC, Article III) or the Articles of Incorporation (corporation, Article VI) filed to form the entity, and the agent signs an acceptance on that filing.",
      sources: [
        {
          url: "https://form.sunbiz.org/pdf/cr2e047.pdf",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote:
            "ARTICLE III - Registered Agent, Registered Office, & Registered Agent's Signature:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://form.sunbiz.org/pdf/cr2e010.pdf",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote:
            "ARTICLE VI REGISTERED AGENT ... The name and Florida street address (P.O. Box NOT acceptable) of the registered agent is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.fl.gov/sunbiz/start-business/efile/fl-profit-corporation/instructions/",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote: "The application must be signed by the registered agent.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 12500,
        corporation: 7000,
      },
      sources: [
        {
          url: "https://dos.fl.gov/sunbiz/forms/fees/llc-fees/",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote: "Total Fee For New Florida/Foreign LLC | $ 125.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://form.sunbiz.org/pdf/cr2e047.pdf",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote:
            "$125.00 Filing Fee for Articles of Organization and Designation of Registered Agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.fl.gov/sunbiz/start-business/efile/fl-profit-corporation/instructions/",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote:
            "Filing Fees $35.00 ... Registered Agent Designation $35.00 ... Certified Copy (optional) $8.75 ... Certificate of Status (optional) $8.75 ... TOTAL $87.50",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://form.sunbiz.org/pdf/cr2e010.pdf",
          publisher:
            "Florida Department of State, Division of Corporations (Sunbiz)",
          quote: "Filing Fee $35.00 ... Designation of Registered Agent $35.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/florida/",
      publisher: "Registered Agents Inc.",
      quote:
        "Florida Registered Agent ... Registered Agents Inc provides service for $200 annually, with annual report compliance built-in.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Corporation formation fee of $70 is the required $35 filing fee plus the $35 registered agent designation. The $78.75 and $87.50 totals shown on Sunbiz pages include optional certified copy and certificate of status fees.",
      "LLC formation $125 is $100 filing fee plus $25 registered agent fee.",
      "Change of agent fee differs by entity type: $25 for LLCs, $35 for corporations.",
      "The new registered agent must sign an acceptance on the statement of change (both LLC and corporation forms).",
    ],
    unverified: [],
    stateBlockers: [],
  },
  GA: {
    change: {
      formName:
        "Amended Annual Registration (or the Annual Registration, if filed at renewal time); paper templates Form CD 920 (LLC) and Form CD 900 (Corporation)",
      governmentFeeCents: {
        llc: 3000,
        corporation: 3000,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://sos.ga.gov/page/business-division-faq",
          publisher: "Georgia Secretary of State, Corporations Division",
          quote:
            "The name of the registered agent and/or the registered office of an entity can be changed by filing an annual registration or an amended annual registration",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.ga.gov/index.php/node/1925",
          publisher: "Georgia Secretary of State, Corporations Division",
          quote:
            "Amended Annual Registration $20.00 +$10.00 $30.00 $20.00 +$10.00 $30.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC) or the Articles of Incorporation (corporation) filed to form the entity; the agent must be located in Georgia.",
      sources: [
        {
          url: "https://sos.ga.gov/how-to-guide/how-guide-register-domestic-entity",
          publisher: "Georgia Secretary of State, Corporations Division",
          quote:
            "Select a registered agent for your company. ... A registered agent must be located in Georgia. ... Name and address of the registered agent.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 11000,
      },
      sources: [
        {
          url: "https://sos.ga.gov/index.php/node/1925",
          publisher: "Georgia Secretary of State, Corporations Division",
          quote:
            "Articles of Incorporation $100.00 +$10.00 $110.00 $100.00 +$10.00 $110.00 ... Articles of Organization (LLC) $100.00 +$10.00 $110.00 $100.00 +$10.00 $110.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.ga.gov/how-to-guide/how-guide-register-domestic-entity",
          publisher: "Georgia Secretary of State, Corporations Division",
          quote: "Pay the $110 fee ($100 filing fee + $10 service charge).",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/georgia/",
      publisher: "Registered Agents Inc.",
      quote:
        "With years of experience as a registered agent in Georgia, we can confidently support your business",
      checkedAt: "2026-10-29",
    },
    notes: [
      "All Georgia fees include a mandatory $10 service charge on top of the statutory fee (fee schedule effective September 6, 2025); online and paper amounts are the same. Fees reported here include that charge.",
      "Georgia has no standalone change of agent form: the agent is changed through an Amended Annual Registration ($20 plus $10 service charge = $30) or at no added cost on the regular Annual Registration ($50 plus $10 = $60) when it is due.",
      "Fee schedule also lists 'Registered Office Address Change ($5.00 per entity; minimum fee = $20.00)' plus $10 service charge; this appears aimed at agents changing their office for many entities.",
      "The Georgia SOS PDF forms (CD 920, CD 900, fee schedule PDF) could not be loaded from this environment; the HTML fee schedule and FAQ were used instead.",
    ],
    unverified: [
      "change.consentRequired: no official Georgia page loaded states whether the new agent's consent is required for an amended annual registration",
      "change.formName: form numbers CD 920 and CD 900 are taken from official sos.ga.gov PDF titles seen in search results, but the PDFs themselves could not be loaded",
      "Georgia corporations must publish notice of incorporation; cost not checked.",
    ],
    stateBlockers: [],
  },
  HI: {
    change: {
      formName: "Form X-7, Statement of Change of Registered Agent By Entity",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://cca.hawaii.gov/breg/registration/dllc/forms/",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote: "X-7 Statement of Change of Registered Agent By Entity",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://cca.hawaii.gov/breg/files/2013/10/X-7.pdf",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote:
            "STATEMENT OF CHANGE OF REGISTERED AGENT BY ENTITY ... Nonrefundable Filing Fee: $25.00* ... The appointment of a registered agent in this statement is an affirmation by the represented entity that the agent has consented to serve as such.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://cca.hawaii.gov/breg/files/2021/03/Form-Fee-Schedule-03-2021.pdf",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote:
            "Statement of Change/Resignation: 200 or less simultaneous filings $25.00 each",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (Form LLC-1, Article 3) or the Articles of Incorporation (Form DC-1, Article 4) filed to form the entity; the entity cannot be its own agent.",
      sources: [
        {
          url: "https://files.hawaii.gov/dcca/breg/registration/forms/llc-1.pdf",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote:
            "The company shall have and continuously maintain in the State of Hawaii, a registered agent who shall have a business address in this State.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://cca.hawaii.gov/breg/files/2023/09/DC-1-Instr.pdf",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote:
            "Indicate whether the corporation's registered agent is an entity OR an individual.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5000,
        corporation: 5000,
      },
      sources: [
        {
          url: "https://files.hawaii.gov/dcca/breg/registration/forms/llc-1-instr.pdf",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote:
            "The fee for filing Articles of Organization is $50.00 and is not refundable.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://cca.hawaii.gov/breg/files/2023/09/DC-1-Instr.pdf",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote:
            "The fee for filing Articles of Incorporation is $50.00 and is not refundable.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://cca.hawaii.gov/breg/files/2021/03/Form-Fee-Schedule-03-2021.pdf",
          publisher:
            "Hawaii Department of Commerce and Consumer Affairs, Business Registration Division",
          quote:
            "there is an additional $1.00 fee imposed by State Archives on permanent records",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/hawaii/",
      publisher: "Registered Agents Inc.",
      quote: "Hiring Registered Agents Inc as your Hawaii registered agent",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Hawaii's fee schedule says an additional $1.00 State Archives preservation fee applies to permanent records, so formation may total $51 in practice; the LLC-1 and DC-1 forms themselves show only the $50 filing fee.",
      "The X-7 change fee is $25 for 200 or fewer affected entities ($1 each for 201 or more, a bulk option for agents).",
      "X-7 states the filing entity affirms the new agent has consented; no separate agent signature is shown.",
      "BREG is moving to a new online portal starting July 6, 2026, and expedited handling is currently unavailable; recheck fees on the new portal.",
    ],
    unverified: [
      "formation: whether the $1 State Archives fee is added to Articles of Organization and Articles of Incorporation is not stated on the form or instruction pages, so it was left out of the cents value",
    ],
    stateBlockers: [],
  },
  IA: {
    change: {
      formName:
        "Statement of Change of Registered Office and/or Registered Agent (Form 635_0119)",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://sos.iowa.gov/business/pdf/635_0119.pdf",
          publisher: "Iowa Secretary of State, Business Services",
          quote:
            "STATEMENT OF CHANGE OF REGISTERED OFFICE AND/OR REGISTERED AGENT ... No fee required. ... The NEW Registered Agent, if any, must sign, consenting to the appointment, or attach a separate written consent to this form.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.legis.iowa.gov/docs/code/489.122.pdf",
          publisher: "Iowa Legislature, Iowa Code 489.122",
          quote:
            "Statement of change of registered agent or address of the registered agent or both ... No fee",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.legis.iowa.gov/docs/code/490.122.pdf",
          publisher: "Iowa Legislature, Iowa Code 490.122",
          quote:
            "Corporation's statement of change of registered agent or registered office or both ... No fee",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Certificate of Organization (LLC) or the Articles of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://help.sos.iowa.gov/how-do-i-form-llc",
          publisher: "Iowa Secretary of State",
          quote:
            "The street address of the initial registered office and the name of the initial registered agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.legis.iowa.gov/docs/code/490.202.pdf",
          publisher: "Iowa Legislature, Iowa Code 490.202",
          quote:
            "The street and mailing addresses of the corporation's initial registered office and the name of its initial registered agent at that office.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5000,
        corporation: 5000,
      },
      sources: [
        {
          url: "https://help.sos.iowa.gov/how-do-i-form-corporation",
          publisher: "Iowa Secretary of State",
          quote: "The cost to form a profit corporation is $50.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.legis.iowa.gov/docs/code/489.122.pdf",
          publisher: "Iowa Legislature, Iowa Code 489.122",
          quote: "Certificate of organization $ 50",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.legis.iowa.gov/docs/code/490.122.pdf",
          publisher: "Iowa Legislature, Iowa Code 490.122",
          quote: "Articles of incorporation ... $ 50",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/iowa/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in Iowa.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Iowa charges no fee to change the registered agent for corporations or LLCs (partnerships pay $5). The one form 635_0119 covers corporations, LLCs, partnerships and cooperatives.",
      "The new registered agent must sign the change form consenting to the appointment, or a separate written consent must be attached.",
      "Iowa does not publish a fill in Certificate of Organization or Articles of Incorporation form for domestic entities on the pages loaded; filers draft the document and can upload it as a PDF through Fast Track Filing at filings.sos.iowa.gov.",
      "The LLC $50 formation fee is confirmed from Iowa Code 489.122 on the Iowa Legislature site; no Secretary of State page loaded states the LLC fee directly.",
    ],
    unverified: [
      "formation.llcFeeCents: confirmed only from Iowa Code 489.122 (legis.iowa.gov), not from a Secretary of State page",
    ],
    stateBlockers: [],
  },
  ID: {
    change: {
      formName:
        "Statement of Change of Registered Agent, Registered Office, or Both",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://archive.sos.idaho.gov/CORP/forms/MISC/Change%20RA%20or%20RO.pdf",
          publisher:
            "Idaho Secretary of State, Business and Commercial Services",
          quote:
            "STATEMENT OF CHANGE OF REGISTERED AGENT, REGISTERED OFFICE, OR BOTH ... Base Filing fee: $0.00 + $20.00 for manual processing (form must be typed). ... If appointing a new registered agent, the newly appointed registered agent must sign ... I consent to serve as registered agent for the above-named entity.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.idaho.gov/business-forms/",
          publisher:
            "Idaho Secretary of State, Business and Commercial Services",
          quote:
            "Paper submissions require an additional $20 manual processing fee and forms submitted without the fee will be rejected.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Certificate of Organization (LLC) or the Articles of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://archive.sos.idaho.gov/CORP/forms/LLC/LLC%20Cert%20Org.pdf",
          publisher:
            "Idaho Secretary of State, Business and Commercial Services",
          quote:
            "The name and complete street address of the registered agent:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://archive.sos.idaho.gov/CORP/forms/CORP/Art%20of%20Incorp%20General.pdf",
          publisher:
            "Idaho Secretary of State, Business and Commercial Services",
          quote: "Article 3: Registered agent name and address:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://archive.sos.idaho.gov/CORP/forms/LLC/LLC%20Cert%20Org.pdf",
          publisher:
            "Idaho Secretary of State, Business and Commercial Services",
          quote:
            "Base Filing fee: $100.00 + $20.00 for manual processing (form must be typed).",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://archive.sos.idaho.gov/CORP/forms/CORP/Art%20of%20Incorp%20General.pdf",
          publisher:
            "Idaho Secretary of State, Business and Commercial Services",
          quote:
            "Base Filing fee: $100.00 + $20.00 for manual processing (form must be typed).",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.idaho.gov/business-forms/",
          publisher:
            "Idaho Secretary of State, Business and Commercial Services",
          quote:
            "Most business filings can be completed online at sosbiz.idaho.gov",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/idaho/",
      publisher: "Registered Agents Inc.",
      quote:
        "Every line of registered agent service in Idaho comes with the following benefits:",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Fees given are online fees (base fee only). Paper filings add a $20 manual processing fee: change of agent $20 on paper, LLC and corporation formation $120 on paper.",
      "The same change form covers corporations, LLCs, LPs and LLPs; a new agent must sign a consent on it, and an officer, member, manager or general partner must also sign.",
      "Forms were loaded from archive.sos.idaho.gov, linked from the official sos.idaho.gov Business Forms page; online filing is at sosbiz.idaho.gov.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  IL: {
    change: {
      formName:
        "Statement of Change of Registered Agent and/or Registered Office (corporation: Form BCA 5.10/5.20; LLC form number not confirmed)",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://ilga.gov/Documents/legislation/ilcs/documents/080501800K50-10.htm",
          publisher:
            "Illinois General Assembly, Illinois Compiled Statutes (805 ILCS 180/50-10, Limited Liability Company Act)",
          quote:
            "Filing a statement of change of address of registered office or change of registered agent, or both, $25.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.ilga.gov/legislation/ilcs/documents/080500050K15.10.htm",
          publisher:
            "Illinois General Assembly, Illinois Compiled Statutes (805 ILCS 5/15.10, Business Corporation Act)",
          quote:
            "(h) Filing statement of change of address of registered office or change of registered agent, or both, $25.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC) or the Articles of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://ilga.gov/legislation/ilcs/documents/080501800K5-5.htm",
          publisher:
            "Illinois General Assembly, Illinois Compiled Statutes (805 ILCS 180/5-5)",
          quote:
            "(3) The name of its registered agent and the address of its registered office.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://ilga.gov/legislation/ilcs/documents/080500050K2.10.htm",
          publisher:
            "Illinois General Assembly, Illinois Compiled Statutes (805 ILCS 5/2.10)",
          quote:
            "(3) the address of the corporation's initial registered office and the name of its initial registered agent at that office;",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 15000,
      },
      sources: [
        {
          url: "https://ilga.gov/Documents/legislation/ilcs/documents/080501800K50-10.htm",
          publisher:
            "Illinois General Assembly, Illinois Compiled Statutes (805 ILCS 180/50-10)",
          quote:
            "Filing articles of organization (domestic), application for admission (foreign), and restated articles of organization (domestic), $150.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.ilga.gov/legislation/ilcs/documents/080500050K15.10.htm",
          publisher:
            "Illinois General Assembly, Illinois Compiled Statutes (805 ILCS 5/15.10)",
          quote: "(a) Filing articles of incorporation, $150.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://ilga.gov/legislation/ilcs/documents/080500050K15.45.htm",
          publisher:
            "Illinois General Assembly, Illinois Compiled Statutes (805 ILCS 5/15.45)",
          quote:
            "in no event shall the initial franchise tax be less than $25.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/illinois/",
      publisher: "Registered Agents Inc.",
      quote:
        "Illinois Registered Agent ... Registered Agents Inc makes managing your business in Illinois easier.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The Illinois Secretary of State site (ilsos.gov and apps.ilsos.gov) refused automated fetching (robots disallowed) and direct download was blocked by this environment's network policy, so every fact here comes from the Illinois Compiled Statutes on ilga.gov (official Illinois General Assembly site), not from the Secretary of State's pages. An operator should confirm on ilsos.gov.",
      "Corporations also owe an initial franchise tax (minimum $25) on top of the $150 articles fee; the $150 figure excludes it.",
      "LLC fee is $400 instead of $150 for an LLC with a series.",
      "The corporation form name BCA 5.10/5.20 comes from the title of the ilsos.gov PDF bca510.pdf seen in search results; the PDF itself could not be loaded.",
    ],
    unverified: [
      "change: fees confirmed only from statute on ilga.gov; Secretary of State fee page and forms could not be loaded (ilsos.gov blocks automated access)",
      "change.formName: LLC form number not confirmed from an official page; corporation form number only from an official PDF title in search results",
      "change.consentRequired: no official page loaded states whether the new agent must consent",
      "formation: fees confirmed only from statute on ilga.gov, not from the Secretary of State site",
      "Corporations also owe an initial franchise tax not included in the filing fee.",
    ],
    stateBlockers: [],
  },
  IN: {
    change: {
      formName:
        "Statement of Change of Registered Agent (State Form 56367); on INBiz shown as Notice of Change of Registered Agent or Office",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://forms.in.gov/Download.aspx?id=13558",
          publisher: "Indiana Secretary of State, Business Services Division",
          quote:
            "STATEMENT OF CHANGE OF REGISTERED AGENT ... State Form 56367 (R5 / 05-24) ... NO FILING FEE ... represent(s) that the Registered Agent named in this Statement ... has consented to the appointment",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://iga.in.gov/ic/2026/Title_23/Article_0.5/Chapter_9.pdf",
          publisher: "Indiana General Assembly, Indiana Code 23-0.5-9-32",
          quote:
            "There is no fee for filing a registered agent or office statement of change.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://inbiz.in.gov/start-business/maintain",
          publisher: "Indiana Secretary of State, INBiz",
          quote:
            "Notice of Change of Registered Agent or Office - used to change registered agent information",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.in.gov/sos/business/files/Regulatory-Analysis-Business-Entity-LSA-25-155-OMB-2024-73R.pdf",
          publisher: "Indiana Secretary of State, Business Services Division",
          quote:
            "RA Change $1 IC 23-0.5-1-5 75 IAC 8-3-8 Document existing enhanced access fee",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in Article II of the Articles of Organization (LLC) or the Articles of Incorporation (corporation) filed to form the entity, with the filer representing that the agent has consented.",
      sources: [
        {
          url: "https://forms.in.gov/Download.aspx?id=16989",
          publisher: "Indiana Secretary of State, Business Services Division",
          quote:
            "ARTICLE II - REGISTERED AGENT INFORMATION ... By checking the box, the Signator(s) represent(s) that the Registered Agent named in the Articles of Organization has consented to the appointment of Registered Agent.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://forms.in.gov/Download.aspx?id=16996",
          publisher: "Indiana Secretary of State, Business Services Division",
          quote: "ARTICLE II - REGISTERED AGENT INFORMATION",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 9500,
        corporation: 9500,
      },
      sources: [
        {
          url: "https://iga.in.gov/ic/2026/Title_23/Article_0.5/Chapter_9.pdf",
          publisher: "Indiana General Assembly, Indiana Code 23-0.5-9",
          quote:
            "Seventy-five dollars ($75) for an electronic filing. ... One hundred dollars ($100) for filing in a manner other than electronically.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.in.gov/sos/business/files/Regulatory-Analysis-Business-Entity-LSA-25-155-OMB-2024-73R.pdf",
          publisher: "Indiana Secretary of State, Business Services Division",
          quote:
            "2. Articles of Incorporation $20.00 ... 5. Domestic LLC Articles of Organization $20.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://forms.in.gov/Download.aspx?id=16989",
          publisher: "Indiana Secretary of State, Business Services Division",
          quote: "FILING FEE: $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://forms.in.gov/Download.aspx?id=16996",
          publisher: "Indiana Secretary of State, Business Services Division",
          quote: "FILING FEE: $100.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/indiana/",
      publisher: "Registered Agents Inc.",
      quote:
        "Indiana Registered Agent ... For $200 a year, we’ve got you covered as your registered agent",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Online (INBiz) fees are given. Formation online is the $75 statutory electronic fee plus a $20 enhanced access fee charged on online filings, for $95; paper formation is $100 (State Form 49459 for LLCs, State Form 4159 for corporations).",
      "Change of registered agent has no statutory filing fee and the paper form says NO FILING FEE; the Secretary of State lists an existing $1 enhanced access fee on online registered agent changes, so online is $1 and paper is $0.",
      "The $95 online formation total is derived by adding the statutory electronic fee and the enhanced access fee from two official documents; no single official page loaded states $95.",
      "Consent: filers check a box representing the new agent has consented (IC 23-0.5-4-6); no separate agent signature.",
    ],
    unverified: [
      "change fees: the $1 online figure comes from the Secretary of State's regulatory analysis listing 'RA Change $1' and 'Change of Registered Agent Address $1.00' as existing enhanced access fees; whether INBiz charges it on every entity agent change was not confirmed on a fee page",
    ],
    stateBlockers: [],
  },
  KS: {
    change: {
      formName:
        "Certificate of Amendment, Change of Resident Agent and/or Registered Office (Form ROA)",
      governmentFeeCents: {
        llc: 3000,
        corporation: 3000,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.sos.ks.gov/forms/business_services/ROA.pdf",
          publisher: "Kansas Secretary of State, Business Services Division",
          quote:
            "All other Businesses paper filing:................... $35 ... All other Businesses online filing:.................. $30",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The resident agent and registered office are named in the Articles of Organization (LLC, Form DL) or the Articles of Incorporation (corporation, Form AI) filed to form the entity.",
      sources: [
        {
          url: "https://www.sos.ks.gov/forms/business_services/dl.pdf",
          publisher: "Kansas Secretary of State, Business Services Division",
          quote:
            "Name of resident agent: ... Must be an individual, the business entity named in section 2, or a business already registered with our office.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.ks.gov/forms/business_services/AI.pdf",
          publisher: "Kansas Secretary of State, Business Services Division",
          quote:
            "Name of resident agent: ... Must be an individual, the business named in section 2, or a business already registered with our office.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 8500,
        corporation: 8500,
      },
      sources: [
        {
          url: "https://www.sos.ks.gov/forms/business_services/dl.pdf",
          publisher: "Kansas Secretary of State, Business Services Division",
          quote:
            "Online Articles of Organization:..................... $85 ... Paper Articles of Organization:...................... $90",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.ks.gov/forms/business_services/AI.pdf",
          publisher: "Kansas Secretary of State, Business Services Division",
          quote:
            "For-profit Corporation paper filing:................. $90 ... For-profit Corporation online filing: ................ $85",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/kansas/",
      publisher: "Registered Agents Inc.",
      quote:
        "We’re happy to provide you registered agent services from our local Kansas office.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Kansas calls the registered agent a 'resident agent'.",
      "Online fees are given: change of agent $30 online, $35 paper; formation $85 online, $90 paper for both LLCs and for-profit corporations.",
      "One form, ROA, covers resident agent and registered office changes for all business types (not-for-profit corporations pay $20).",
      "The LLC instruction sheet (Form DL) is revised 2/27/26; LLC formation fees were lower than in earlier years, so older third party figures may be out of date.",
      "A business may serve as its own resident agent in Kansas.",
    ],
    unverified: [
      "change.consentRequired: the ROA form has no agent consent or acceptance statement and no loaded official page says whether consent is required",
    ],
    stateBlockers: [],
  },
  KY: {
    change: {
      formName:
        "Statement of Change of Registered Agent and/or Registered Office Address (Form RAC)",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.ky.gov/bus/business-filings/Pages/Fees.aspx",
          publisher: "Kentucky Secretary of State, Business Filings",
          quote:
            "Statement of Change of Registered Agent or Registered Office, or Both: $10.00 (not to exceed a total of $2,000.00)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ky.gov/bus/Forms/Documents/RAC-Statment%20of%20Change%20Registered%20Agent.pdf",
          publisher: "Kentucky Secretary of State, Business Filings",
          quote:
            "The filing fee for changing the registered agent or registered office address is $10.00. ... I consent to serve as the registered agent on behalf of the business entity.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC, Form KLC, Article II) or the Articles of Incorporation (corporation, Form BAI, Article III) filed to form the entity, and the agent signs a written consent on that filing.",
      sources: [
        {
          url: "https://web.sos.ky.gov/forms/corp/KLC-Articles%20of%20Organization-Profit%20Limited%20Liability%20Company.pdf",
          publisher: "Kentucky Secretary of State, Business Filings",
          quote:
            "The registered agent shall give written consent to accept the appointment by signing this document or an attachment.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://web.sos.ky.gov/forms/corp/BAI-Articles%20of%20Incorporation-Profit%20Corporation.pdf",
          publisher: "Kentucky Secretary of State, Business Filings",
          quote:
            "Article III: The street address of the corporation's initial registered office in Kentucky is ... and the name of the initial registered agent at that office is",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 4000,
      },
      sources: [
        {
          url: "https://www.sos.ky.gov/bus/business-filings/Pages/Fees.aspx",
          publisher: "Kentucky Secretary of State, Business Filings",
          quote: "Articles of Organization: $40.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://web.sos.ky.gov/forms/corp/BAI-Articles%20of%20Incorporation-Profit%20Corporation.pdf",
          publisher: "Kentucky Secretary of State, Business Filings",
          quote:
            "1. Articles of Incorporation $40.00 ... 2. Organization Tax Fee for 1,000 shares or less +$10.00 ... Total Filing Fee $50.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://web.sos.ky.gov/forms/corp/KLC-Articles%20of%20Organization-Profit%20Limited%20Liability%20Company.pdf",
          publisher: "Kentucky Secretary of State, Business Filings",
          quote: "The filing fee for the document is $40.00.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/kentucky/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc in Kentucky, we give you the benefits of a familiar local registered agent",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Corporation formation of $50 is the $40 articles fee plus the minimum $10 organization tax for 1,000 shares or fewer; more authorized shares raise the organization tax ($.01 per share up to 20,000 shares, then lower rates).",
      "The fee page lists no separate online and paper fees.",
      "The new registered agent signs a consent on the RAC change form ('I consent to serve as the registered agent on behalf of the business entity').",
    ],
    unverified: [
      "Corporation fee includes an organization tax that rises with authorized shares.",
    ],
    stateBlockers: [],
  },
  LA: {
    change: {
      formName:
        "LLC: Change of Registered Office or Agent, Louisiana Limited Liability Company (form 983); Corporation: Statement of Change, Louisiana Corporation",
      governmentFeeCents: {
        llc: 3000,
        corporation: 3000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://static.sos.la.gov/shared/fee_changes_2026.pdf",
          publisher: "Louisiana Secretary of State, Commercial Division",
          quote:
            "Change of Registered Office or Agent-Louisiana Limited Liability Company $30",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://static.sos.la.gov/shared/fee_changes_2026.pdf",
          publisher: "Louisiana Secretary of State, Commercial Division",
          quote: "Statement of Change-Louisiana Corporation $30",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legis.la.gov/legis/Law.aspx?d=76255",
          publisher: "Louisiana State Legislature (La. R.S. 12:1308)",
          quote:
            "accompanied by a notarized affidavit of acknowledgment and acceptance",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legis.la.gov/Legis/LawPrint.aspx?d=920230",
          publisher: "Louisiana State Legislature (La. R.S. 12:1-502)",
          quote:
            "the new agent's signed written consent to the appointment, either on the statement or attached to it",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "LLC: the registered agent is named in the initial report filed with the Articles of Organization, with a notarized affidavit of acknowledgment and acceptance signed by the agent. Corporation: the initial registered agent is named in the Articles of Incorporation, with the agent's written consent attached.",
      sources: [
        {
          url: "https://legis.la.gov/legis/Law.aspx?d=76252",
          publisher:
            "Louisiana State Legislature (La. R.S. 12:1305, Articles of organization; initial report)",
          quote:
            "The full name and municipal address, if any, not a post office box only, of each of its registered agents.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legis.la.gov/legis/Law.aspx?d=76252",
          publisher: "Louisiana State Legislature (La. R.S. 12:1305)",
          quote:
            "A notarized affidavit of acknowledgment and acceptance signed by each of its registered agents.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legis.la.gov/Legis/Law.aspx?d=920205",
          publisher: "Louisiana State Legislature (La. R.S. 12:1-202)",
          quote:
            "The name and street address, not a post office box only, of its initial registered agent.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 12500,
        corporation: 9500,
      },
      sources: [
        {
          url: "https://static.sos.la.gov/shared/fee_changes_2026.pdf",
          publisher: "Louisiana Secretary of State, Commercial Division",
          quote:
            "Articles of Organization-Louisiana Limited Liability Company $125",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://static.sos.la.gov/shared/fee_changes_2026.pdf",
          publisher: "Louisiana Secretary of State, Commercial Division",
          quote: "Articles of Incorporation Louisiana Business $95",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/louisiana/",
      publisher: "Registered Agents Inc.",
      quote:
        "Louisiana Registered Agent ... Registered Agents Inc offers you more than just registered agent service.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Fees are from the Secretary of State fee schedule headed Effective 10/1/26 (fee increase under Act 921 of the 2026 Regular Session); older pages and third party sites show the lower pre October 2026 fees.",
      "Credit card payments carry an additional $5 statutory convenience fee per the same schedule.",
      "The LLC change filing needs a notarized affidavit of acknowledgment and acceptance signed by the new agent; the corporation statement of change needs the new agent's signed written consent.",
      "www.sos.la.gov blocks automated fetching (robots), so form pages and form PDFs could not be loaded; consent and appointment facts come from the Louisiana Revised Statutes on legis.la.gov rather than a Secretary of State page. The LLC form number 983 comes from the Secretary of State form PDF file name seen in search results, not a loaded page.",
      "The corporation form name is taken from the fee schedule line; the exact title on the corporation form PDF was not loaded.",
    ],
    unverified: [
      "change.formName (corporation): exact form title and number not loaded because www.sos.la.gov blocks automated fetching; name taken from the fee schedule line",
      "appointment and consent: sourced from Louisiana Revised Statutes (legis.la.gov), not from a Secretary of State page, because www.sos.la.gov could not be loaded",
    ],
    stateBlockers: [],
  },
  MA: {
    change: {
      formName:
        "LLC: Limited Liability Company Statement of Change of Resident Agent/Resident Office; Corporation: Statement of Change of Registered Agent/Registered Office",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156cfdllcagentoffice.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote: "Statement of Change of Resident Agent/Resident Office",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156cfdllcagentoffice.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "consent to my appointment as resident agent pursuant to G.L. Chapter 156C Section 5A and Section 51.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156ds502s1508950c11321.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "consent to my appointment as registered agent pursuant to G.L. Chapter 156D, Section 5.02.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/general-information/corporations-filing-fees.htm",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "$25.00 for paper or fax filings (no fee if filed electronically)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/general-information/corporations-filing-fees.htm",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote: "Paper or Fax: $25.00 (no fee if filed electronically)",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "LLC: the resident agent is named in the Certificate of Organization, with the agent's consent on the certificate. Corporation: the initial registered agent and registered office are named in the Articles of Organization.",
      sources: [
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156c512dllccert.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "(5) The name and street address, of the resident agent in the commonwealth:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156c512dllccert.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "consent to my appointment as resident agent pursuant to G.L. c 156C § 12",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156ds202950c11316.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "b. The name of its initial registered agent at its registered office:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 50000,
      },
      sources: [
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156c512dllccert.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote: "Filing fee: $500",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/general-information/corporations-filing-fees.htm",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "$275.00 min. for up to 275,000 shares; ($100 for each additional 100,000 shares)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sec.state.ma.us/divisions/corporations/download/c156ds202950c11316.pdf",
          publisher:
            "Secretary of the Commonwealth of Massachusetts, Corporations Division",
          quote:
            "Filing fee: $275 for up to 275,000 shares plus $100 for each additional 100,000 shares or any fraction thereof.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/massachusetts/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in MA.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Change of agent fee: $0 if filed electronically (reported here as the online fee); $25 if filed on paper or by fax, for both LLCs and corporations.",
      "Massachusetts LLCs have a resident agent; corporations have a registered agent. The change forms carry a consent of the new agent (G.L. c. 156C sections 5A and 51 for LLCs; G.L. c. 156D section 5.02 for corporations).",
      "Corporation formation fee of $275 covers up to 275,000 authorized shares; each additional 100,000 shares or fraction adds $100.",
      "A separate form, Statement of Change of Registered Office Address by Registered Agent, is filed by the agent itself when only its address changes; it is not the form for replacing the agent.",
      "The corporation Articles of Organization PDF loaded shows no agent consent block; the source for consent at formation for corporations was not confirmed.",
    ],
    unverified: ["Corporation formation fee rises with authorized shares."],
    stateBlockers: [],
  },
  MD: {
    change: {
      formName: "Resolution to Change Principal Office or Resident Agent",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://dat.maryland.gov/Documents/Accessible%20Documents/Charter%20-%20Make%20Changes%20to%20an%20Existing%20Business/Change%20Principal%20Office%20or%20Resident%20Agent%20(Resolution)_0326-A.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote: "RESOLUTION TO CHANGE PRINCIPAL OFFICE OR RESIDENT AGENT",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dat.maryland.gov/Documents/Accessible%20Documents/Charter%20-%20Make%20Changes%20to%20an%20Existing%20Business/Change%20Principal%20Office%20or%20Resident%20Agent%20(Resolution)_0326-A.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote:
            "$25.00 per corporation, limited partnership, limited liability company or limited liability partnership",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dat.maryland.gov/Documents/Accessible%20Documents/Charter%20-%20Make%20Changes%20to%20an%20Existing%20Business/Change%20Principal%20Office%20or%20Resident%20Agent%20(Resolution)_0326-A.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote:
            "I hereby consent to my designation in this document as resident agent for this entity.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dat.maryland.gov/businesses/documents/fees.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote:
            "Change of Principal Office Resident Agent & Resident Agent's Address $25",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The resident agent is named in the Articles of Organization (LLC) or Articles of Incorporation (corporation) filed to form the entity, and the resident agent signs a consent on the same document.",
      sources: [
        {
          url: "https://dat.maryland.gov/Documents/Accessible%20Documents/Charter%20-%20Create%20or%20Start%20a%20Business/Articles%20of%20Organization%20for%20a%20Limited%20Liability%20Company_0526-A.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote:
            "(7) Resident Agent's Consent: (Required) I consent to serve as Resident Agent for this LLC.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dat.maryland.gov/SDAT%20Forms/stock.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote:
            "The name of the resident agent of the corporation in Maryland is",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dat.maryland.gov/SDAT%20Forms/stock.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote:
            "I hereby consent to my designation in this document as resident agent for this corporation.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
      },
      sources: [
        {
          url: "https://dat.maryland.gov/Documents/Accessible%20Documents/Charter%20-%20Create%20or%20Start%20a%20Business/Articles%20of%20Organization%20for%20a%20Limited%20Liability%20Company_0526-A.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote: "Fee: $100",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dat.maryland.gov/businesses/documents/fees.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote: "Articles of Organization $100 (domestic)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dat.maryland.gov/SDAT%20Forms/stock.pdf",
          publisher: "Maryland State Department of Assessments and Taxation",
          quote:
            "The fee to file Articles of Incorporation is $100.00 plus a $20.00 organization and capitalization fee for a total of $120.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/maryland/",
      publisher: "Registered Agents Inc.",
      quote:
        "Maryland Registered Agent ... At Registered Agents Inc, our professional registered agent service is just $200 per year.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Maryland calls the registered agent the resident agent; the change form is a single Resolution to Change Principal Office or Resident Agent used by corporations, LLCs, LPs and LLPs.",
      "The new resident agent must sign the consent on the resolution.",
      "The $120 stock corporation fee applies when the aggregate par value of stock is not over $100,000; higher capitalization raises the organization and capitalization fee.",
      "Expedited review is extra (the 05/2026 LLC form lists $150 total for expedited and $425 online same day; the May 2024 fee schedule and stock form list a $50 expedite add on). Standard fees are reported here.",
      "The Maryland Business Express online fee schedule blocks automated fetching, so online fees could not be compared with paper fees.",
    ],
    unverified: [
      "online vs paper fee difference: egov.maryland.gov Business Express fee schedule blocks automated fetching (robots)",
      "Corporation fee includes an organization and capitalization fee that rises with par value.",
    ],
    stateBlockers: [],
  },
  ME: {
    change: {
      formName:
        "Statement of Appointment or Change of Clerk or Registered Agent (Domestic and Foreign Entities), form CLKRA-3",
      governmentFeeCents: {
        llc: 3500,
        corporation: 3500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/CLKRA3.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote:
            "STATEMENT OF APPOINTMENT OR CHANGE OF CLERK OR REGISTERED AGENT",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/CLKRA3.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote: "For-Profit Entity Filing Fee $35.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/CLKRA3.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote:
            "Pursuant to 5 MRSA §105.2 or 108.3, the clerk or registered agent as listed above has consented",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.maine.gov/sos/corporations-commissions/i-need-a-business-form/limited-liability-company-forms",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote:
            "Statement of Appointment or Change of Commercial or Noncommercial Registered Agent",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "LLC: the registered agent (commercial or noncommercial) is named in the Certificate of Formation (MLLC-6), which states the agent has consented. Corporation: the clerk (Maine's term for the registered agent) is named in the Articles of Incorporation (MBCA-6), which states the clerk has consented.",
      sources: [
        {
          url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/mllc6.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote:
            "FIFTH: The Registered Agent is a: (select either a Commercial or Noncommercial Registered Agent)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/mllc6.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote:
            "SIXTH: Pursuant to 5 MRSA §105.2, the registered agent listed above has consented to serve as the registered agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www1.maine.gov/sos/sites/maine.gov.sos/files/inline-files/mbca6.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote:
            "FOURTH: The Clerk is a: (select either a Commercial or Noncommercial Clerk",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 17500,
        corporation: 14500,
      },
      sources: [
        {
          url: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/mllc6.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote: "Filing Fee $175.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www1.maine.gov/sos/sites/maine.gov.sos/files/inline-files/mbca6.pdf",
          publisher:
            "Maine Secretary of State, Bureau of Corporations, Elections and Commissions",
          quote: "Filing Fee $145.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/maine/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your Maine registered agent, we go above and beyond as your registered agent.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Maine business corporations have a clerk rather than a registered agent; the same CLKRA-3 form changes the clerk of a corporation or the registered agent of an LLC.",
      "CLKRA-3 is a statement of consent form: it recites that the new clerk or registered agent has consented (5 MRSA 105.2 or 108.3); a commercial agent is identified by its CRA public number.",
      "Nonprofit corporations pay $15 for CLKRA-3; for-profit entities pay $35.",
      "The business corporation forms page labels CLKRA-3 as Statement of Appointment or Change of Commercial or Noncommercial Clerk; the LLC forms page labels it as ... Registered Agent; the PDF itself is titled Statement of Appointment or Change of Clerk or Registered Agent.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  MI: {
    change: {
      formName:
        "Certificate of Change of Registered Office and/or Change of Resident Agent (CSCL/CD 520)",
      governmentFeeCents: {
        llc: 500,
        corporation: 500,
      },
      newAgentConsentRequired: false,
      sources: [
        {
          url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/cscl/NonImages_new/Corps/forms/corporation/520-0725.pdf",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote:
            "Certificate of Change of Registered Office and/or Change of Resident Agent (CSCL/CD 520)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/cscl/NonImages_new/Corps/forms/corporation/520-0725.pdf",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote:
            "Domestic and Foreign Corporations and Limited Liability Companies",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/cscl/NonImages_new/Corps/forms/corporation/520-0725.pdf",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote:
            "The resident agent may sign if only the registered office is changed.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.michigan.gov/lara/bureau-list/cscl/corps/filing-fees/domestic-profit-professional",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote:
            "Certificate of Change of Registered Office/Resident Agent *$5.00* Yes",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The resident agent and registered office are named in Article IV of the Articles of Organization (LLC, CSCL/CD 700) or the Articles of Incorporation (corporation, CSCL/CD 500) filed to form the entity.",
      sources: [
        {
          url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/cscl/NonImages_new/Corps/forms/llc/700-0725.pdf?rev=9465d7fcbb2646628497d90d6e195cd2&hash=ED0E26948FB71EE36AAA76FCD0614ED5",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote:
            "1. The name of the resident agent at the registered office is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/cscl/NonImages_new/Corps/forms/corporation/500-0725.pdf?rev=ff99d1f39a0f4960a7dc5c43163414da&hash=232E084118BDBECF04E6F1AC4DA4991B",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote:
            "1. The name of the resident agent at the registered office is:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5000,
      },
      sources: [
        {
          url: "https://www.michigan.gov/lara/-/media/Project/Websites/lara/cscl/NonImages_new/Corps/forms/llc/700-0725.pdf?rev=9465d7fcbb2646628497d90d6e195cd2&hash=ED0E26948FB71EE36AAA76FCD0614ED5",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote:
            "check or money order........................................... $50.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.michigan.gov/lara/bureau-list/cscl/corps/filing-fees/domestic-profit-professional",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote: "Non-Refundable Fee: $10.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.michigan.gov/lara/bureau-list/cscl/corps/filing-fees/domestic-profit-professional",
          publisher:
            "Michigan Department of Licensing and Regulatory Affairs, Corporations Division",
          quote: "1-60,000: $50.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/michigan/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in Michigan.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Michigan calls the registered agent the resident agent; the same Form 520 is used for corporations and LLCs per the verified change facts supplied.",
      "Corporation formation fee is a $10 nonrefundable filing fee plus an organization fee based on authorized shares; $60 total is the minimum (1 to 60,000 shares). 60,001 to 1,000,000 shares raises the organization fee to $100, and so on.",
      "Form 520 has no signature or consent block for the new resident agent; it is signed by an authorized officer or agent (corporation) or a manager, member or authorized agent (LLC), and the resident agent may sign only when just the registered office changes. consentRequired is set to false on that basis; the statute itself was not checked.",
    ],
    unverified: ["Corporation formation fee rises with authorized shares."],
    stateBlockers: [],
  },
  MN: {
    change: {
      formName: "Notice of Change of Registered Office/Registered Agent",
      governmentFeeCents: {
        llc: 3500,
        corporation: 3500,
      },
      newAgentConsentRequired: false,
      sources: [
        {
          url: "https://www.sos.mn.gov/media/1382/changeofregisteredofficeagent.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote: "Notice of Change of Registered Office/Registered Agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mn.gov/media/1382/changeofregisteredofficeagent.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote:
            "$55 for expedited service in-person and online filings, $35 if submitted by mail",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mn.gov/media/1382/changeofregisteredofficeagent.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote: "Signature of Authorized Person or Authorized Agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mn.gov/business-liens/business-forms-fees/business-filing-and-certification-fee-schedule/",
          publisher: "Minnesota Secretary of State, Business Services",
          quote:
            "Change of Registered Office Address and/or Registered Agent | $35.00 | $55.00 | $55.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered office address, and the registered agent if the entity has one, are listed in Article II of the Articles of Organization (LLC) or Articles of Incorporation (business corporation) filed to form the entity. A registered agent is optional in Minnesota; a Minnesota registered office address is required.",
      sources: [
        {
          url: "https://www.sos.mn.gov/media/1824/llcarticlesoforganization.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote:
            "Article II - Registered Office Address and Agent (A Registered Office Address is Required)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mn.gov/media/1824/llcarticlesoforganization.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote: "An Agent is not required.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mn.gov/media/1388/domesticbusinesscorparticlesofinc.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote: "The Registered Agent at the above address is:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 13500,
        corporation: 13500,
      },
      sources: [
        {
          url: "https://www.sos.mn.gov/media/1824/llcarticlesoforganization.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote:
            "Filing Fee: $155 for expedited service in-person and online filings, $135 if by mail",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mn.gov/media/1388/domesticbusinesscorparticlesofinc.pdf",
          publisher: "Minnesota Secretary of State, Business Services",
          quote:
            "Filing Fee: $155 for expedited service in-person and online filings, $135 if submitted by mail",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mn.gov/business-liens/business-forms-fees/business-filing-and-certification-fee-schedule/",
          publisher: "Minnesota Secretary of State, Business Services",
          quote:
            "Articles of Organization - Original Filing | $135.00 | $155.00 | $155.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/minnesota/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in Minnesota.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Online and in person filings are always expedited in Minnesota and cost more: formation $155 (LLC and corporation) and change of agent $55. The fees reported here are the standard non expedited mail fees ($135 formation, $35 change), because the online fee includes expedited service. Use $155 / $55 if the operator wants the online price.",
      "A registered agent is optional in Minnesota; the registered office address is mandatory. The change form can add, change or remove an agent.",
      "The change form is signed by the entity's authorized person; it has no signature or consent block for the new agent, so consentRequired is false based on the form.",
      "The same Notice of Change form covers Minnesota business corporations, LLCs, cooperatives and nonprofits (not limited partnerships or LLPs).",
    ],
    unverified: [],
    stateBlockers: [],
  },
  MO: {
    change: {
      formName:
        "Statement of Change of Registered Agent and/or Registered Office (Corp. 59), used by corporations and LLCs",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.mo.gov/cmsimages/business/corp59.pdf",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote:
            "by a Foreign or Domestic For Profit or Nonprofit Corporation or a Limited Liability Company",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/cmsimages/business/corp59.pdf",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote: "There is a $10.00 fee for filing this statement.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/cmsimages/business/corp59.pdf",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote:
            "Authorized signature of new registered agent must appear below:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/fees.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote: "Change of Registered Agent / Office Address / or both",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC, form LLC 1, Article 3) or the Articles of Incorporation (corporation, form Corp. 41, Article Two) filed to form the entity.",
      sources: [
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/llc1.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote:
            "The name and address of the limited liability company's registered agent in Missouri is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/corp41.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote: "The registered agent’s name is",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5000,
      },
      sources: [
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/fees.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote: "Certificates of Limited Liability Company (domestic)(online)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/fees.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote:
            "Certificates of Limited Liability Company (domestic/foreign)(paper)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/llc1.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote: "(Submit with filing fee of $105.00)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/fees.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote:
            "Missouri Domestic fees are based on dollar amount of authorized capital.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.mo.gov/CMSImages/Business/fees.pdf?v=2025",
          publisher: "Missouri Secretary of State, Corporations Division",
          quote: "$30,000 or less",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/missouri/",
      publisher: "Registered Agents Inc.",
      quote:
        "Missouri Registered Agent ... Our local Missouri office staff receives and uploads all your legal mail as it comes in.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "LLC formation: $50 online (reported) vs $105 on paper, per the fee schedule (online row 50.00, paper row $105.00).",
      "Corporation formation fee depends on authorized capital: $58 for $30,000 or less of authorized shares (includes the $3 certificate fee and $5 Technology fund fee), plus $5 for each additional $10,000. $58 is the minimum and is reported here. The schedule shows no online vs paper difference for incorporation.",
      "Change of agent: the same Corp. 59 form serves corporations and LLCs; $10 under the fee schedule row for all others. The new registered agent must sign the form, or an originally executed written consent may be attached instead.",
      "The fee schedule quote for the LLC rows and the corporation tier is split across label and amount on the page (dot leaders); amounts are 50.00 online, $105.00 paper, and $58.00 for the first tier.",
    ],
    unverified: ["Corporation formation fee rises with authorized capital."],
    stateBlockers: [],
  },
  MS: {
    change: {
      formName:
        "Registered Agent/Office Statement of Change (F0010), filed online as an amendment on an existing business",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.ms.gov/content/documents/Business/Services%20&%20Fees%20Document.pdf",
          publisher: "Mississippi Secretary of State, Business Services",
          quote:
            "Registered Agent/Office Statement of Change.................. $10",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ms.gov/content/documents/Business/FeeSchedule.pdf",
          publisher: "Mississippi Secretary of State, Business Services",
          quote: "F0010   LLC Registered Agent/Office Statement of Change $10",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ms.gov/content/documents/Business/FeeSchedule.pdf",
          publisher: "Mississippi Secretary of State, Business Services",
          quote:
            "F0010   Registered Agent/Office Statement of Change-Profit Corporation $10",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ms.gov/business-services/business-faqs",
          publisher: "Mississippi Secretary of State, Business Services",
          quote:
            "Registered agent changes are handled as an amendment using the process outlined above.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ms.gov/business-services-external-affairs/registered-agents",
          publisher: "Mississippi Secretary of State, Business Services",
          quote:
            "must obtain that agent's permission prior to listing the agent on any forms",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "LLC: the registered agent is named in the Certificate of Formation filed to form the LLC. Corporation: presumably named in the Articles of Incorporation, but not confirmed from an official page.",
      sources: [
        {
          url: "https://www.sos.ms.gov/content/documents/pol_res/llcs/1revisedLLCact.pdf",
          publisher:
            "Mississippi Secretary of State (Mississippi Limited Liability Company Act, 2010 text)",
          quote:
            "the name and the street and mailing address of the registered agent for service of process",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5000,
        corporation: 5000,
      },
      sources: [
        {
          url: "https://www.sos.ms.gov/content/documents/Business/Services%20&%20Fees%20Document.pdf",
          publisher: "Mississippi Secretary of State, Business Services",
          quote:
            "Certificate of Formation of MS LLC.................................... $50",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ms.gov/content/documents/Business/Services%20&%20Fees%20Document.pdf",
          publisher: "Mississippi Secretary of State, Business Services",
          quote:
            "Articles of Incorporation.................................................... $50",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/mississippi/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in MS.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Fees are from the Services and Fees Schedule Revised October 2024 and match the older fee schedule.",
      "Per the Business FAQs there is no longer a separate paper form to change the registered agent; the change is filed online through File an Amendment on an Existing Business, and the fee schedule lists it as Registered Agent/Office Statement of Change (F0010), $10. The FAQs say forms may be completed online and printed and mailed with a check if the filer does not want to pay online.",
      "Consent: Mississippi follows a registered agents scheme in which a commercial registered agent gives its initial consent by filing its commercial registered agent listing statement (and may file a Statement of Non-acceptance within 14 days); for a noncommercial agent the company must obtain the agent's permission before listing it, but no consent document is shown as filed. Older statute text on the SOS site (corporation act amendments and the 2010 LLC Act) required the new agent's written consent on or attached to the statement of change; it is not confirmed that this text is current.",
    ],
    unverified: [
      "appointment (corporation): no official page loaded states that the registered agent is named in the Articles of Incorporation; the online filing system pages could not be loaded",
      "appointment (LLC): source is the 2010 LLC Act text hosted on the SOS site, which may predate later amendments",
    ],
    stateBlockers: [],
  },
  MT: {
    change: {
      formName: "Statement of Change of Registered Office/Agent",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://sosmt.gov/business/fees/",
          publisher: "Montana Secretary of State, Business Services",
          quote: "Statement Of Change - Registered Office, Agent, Both",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sosmt.gov/business/fees/",
          publisher: "Montana Secretary of State, Business Services",
          quote: "Statement Of Change - Registered Office/Agent/Both",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://mca.legmt.gov/bills/mca/title_0350/chapter_0070/part_0010/section_0080/0350-0070-0010-0080.html",
          publisher:
            "Montana Legislature (MCA 35-7-108, Change of registered agent by entity)",
          quote:
            "The appointment of a registered agent pursuant to subsection (1) is an affirmation by the represented entity",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the entity's public organic document filed to form it (Articles of Organization for an LLC, Articles of Incorporation for a corporation), which Montana law treats as a registered agent filing.",
      sources: [
        {
          url: "https://mca.legmt.gov/bills/mca/title_0350/chapter_0070/part_0010/section_0050/0350-0070-0010-0050.html",
          publisher:
            "Montana Legislature (MCA 35-7-105, Appointment of registered agent)",
          quote: "A registered agent filing must state:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://mca.legmt.gov/bills/mca/title_0350/chapter_0070/part_0010/section_0020/0350-0070-0010-0020.html",
          publisher: "Montana Legislature (MCA 35-7-102, Definitions)",
          quote: "the public organic document of a domestic filing entity;",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sosmt.gov/business/business-structures/",
          publisher: "Montana Secretary of State, Business Services",
          quote:
            "Articles of Organization and annual reports must be filed with the Secretary of State’s Office.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 3500,
        corporation: 3500,
      },
      sources: [
        {
          url: "https://sosmt.gov/business/fees/",
          publisher: "Montana Secretary of State, Business Services",
          quote:
            "$35.00 plus $50.00 for each series member named in the series LLC",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sosmt.gov/business/fees/",
          publisher: "Montana Secretary of State, Business Services",
          quote: "Articles Of Incorporation - Profit Corporation",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/montana/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc offers trusted registered agent service to satisfy Montana requirements",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Change of registered office or agent is free for both LLCs and corporations (fee page shows NO FEE).",
      "Montana follows the Model Registered Agents Act: no separate consent document is filed, but naming an agent is the entity's affirmation that the agent has consented to serve (MCA 35-7-105 and 35-7-108). consentRequired is true on that basis.",
      "LLC formation is $35, plus $50 for each series named in a series LLC. Corporation (profit) formation is $35; the fee page row reads Articles Of Incorporation - Profit Corporation | $35.00.",
      "The fee page lists one fee per filing and does not distinguish online from paper.",
      "Appointment and consent facts come from the Montana Code Annotated on mca.legmt.gov (Montana Legislature); the Secretary of State help pages loaded did not describe how the agent is named at formation.",
    ],
    unverified: [
      "appointment: no Secretary of State page loaded explicitly states the agent is named in the Articles; sourced from MCA 35-7-102 and 35-7-105 instead",
    ],
    stateBlockers: [],
  },
  NC: {
    change: {
      formName:
        "Statement of Change of Registered Office and/or Registered Agent (Form BE-06)",
      governmentFeeCents: {
        llc: 500,
        corporation: 500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sosnc.gov/webfiles/documents/forms/Business_Registration/business_Entities_common/statement_of_change_of_registered_office_and_or_registered_agent.pdf",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote: "Filing fee is $5.00.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sosnc.gov/webfiles/documents/forms/Business_Registration/business_Entities_common/statement_of_change_of_registered_office_and_or_registered_agent.pdf",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote:
            "3. The name of the new registered agent and the new agent's consent to appointment appears below:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sosnc.gov/fees/by_title/_Business_Registration/",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote:
            "Limited Liability Company's Statement of Change of Registered Agent and/or Registered Office - $5.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sosnc.gov/fees/by_title/_Business_Registration_Business_corporations",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote:
            "Statement of Change of Address of Registered Office and/or Registered Agent (Dom and For) - $5.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (Form L-01) for an LLC or the Articles of Incorporation (Form B-01) for a corporation, filed to form the entity.",
      sources: [
        {
          url: "https://www.sosnc.gov/webfiles/documents/forms/Business_Registration/limited_liability_companies/articles_of_organization.pdf",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote: "3. The name of the initial registered agent is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sosnc.gov/webfiles/documents/forms/Business_Registration/business_Corporations/articles_of_incorporation_for_business.pdf",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote: "Enter the name of the registered agent.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 12500,
        corporation: 12500,
      },
      sources: [
        {
          url: "https://www.sosnc.gov/webfiles/documents/forms/Business_Registration/limited_liability_companies/articles_of_organization.pdf",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote: "Filing fee is $125.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sosnc.gov/webfiles/documents/forms/Business_Registration/business_Corporations/articles_of_incorporation_for_business.pdf",
          publisher:
            "North Carolina Department of the Secretary of State, Business Registration Division",
          quote:
            "Filing fee is $125. This document must be filed with the Secretary of State.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/north-carolina/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc., you get an expert registered agent in North Carolina.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Online filings add a non refundable electronic fee: $3.00 for credit card payments or $2.00 for ACH. The base filing fees are the same online and on paper.",
      "On Form BE-06 the new registered agent signs item 3, or may instead sign a separate written consent that must be attached to the statement.",
      "Form BE-06 is in the Secretary of State's common business entity forms; the fee table lists the LLC and corporation versions of the statement of change at $5.00 each.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  ND: {
    change: {
      formName:
        "Statement of change of noncommercial registered agent or address (Registered Agent/Office Change), filed through the FirstStop Portal",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.nd.gov/business/business-services/registered-agents",
          publisher: "North Dakota Secretary of State, Business Services",
          quote:
            "Statement of change of noncommercial registered agent or address (not resulting from rezoning or postal reassignment) - $10",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.nd.gov/business/business-services/registered-agents",
          publisher: "North Dakota Secretary of State, Business Services",
          quote:
            "Businesses must obtain an agent's approval before naming them as a commercial or noncommercial registered agent.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.nd.gov/business/business-services/registered-agents",
          publisher: "North Dakota Secretary of State, Business Services",
          quote:
            "Proof of the approval is not required to be filed with the Secretary of State.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.nd.gov/business/business-services/maintain-registration",
          publisher: "North Dakota Secretary of State, Business Services",
          quote: "Registered Agent/Office Change - $10",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the registration filed to form the entity (articles of organization for an LLC, articles of incorporation for a corporation), filed through the FirstStop Portal; naming the agent affirms the agent has consented.",
      sources: [
        {
          url: "https://www.sos.nd.gov/business/business-services/register-business",
          publisher: "North Dakota Secretary of State, Business Services",
          quote:
            "must maintain a North Dakota registered agent that has a physical address in North Dakota.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://ndlegis.gov/cencode/t10c01-1.pdf",
          publisher:
            "North Dakota Legislative Branch, North Dakota Century Code chapter 10-01.1",
          quote:
            "is an affirmation by the represented entity that the agent has consented to serve as such.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 13500,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://www.sos.nd.gov/business/business-services/business-structures/limited-liability-company-llc",
          publisher: "North Dakota Secretary of State, Business Services",
          quote: "Registration (domestic and foreign) - $135",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.nd.gov/business/business-services/business-structures/corporation",
          publisher: "North Dakota Secretary of State, Business Services",
          quote: "Registration (domestic) - $100",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/north-dakota/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the only choice for a North Dakota registered agent.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "North Dakota formation and most maintenance filings are done online in the FirstStop Portal; the Secretary of State does not publish standalone PDF forms for business LLC or corporation formation or for an agent change, so the exact form name is the fee line wording.",
      "The $10 change fee is per entity when the agent is a noncommercial agent. If the new agent is a commercial registered agent on the Commercial Registered Agent listing, the entity names the commercial agent by name only.",
      "Consent: the entity must get the agent's approval first, but proof of approval is not filed. Under NDCC 10-01.1-08(3) the statement of change itself affirms the agent consented.",
      "The SOS pages describe the LLC fee as 'Registration (domestic and foreign)' and the corporation fee as 'Registration (domestic)'; the pages say an LLC is created by filing articles of organization and a corporation by filing articles of incorporation.",
    ],
    unverified: [
      "appointment: no SOS page or form loaded states in words that the agent is named in the articles; this is supported by the SOS requirement to maintain an agent and by NDCC 10-01.1 on the Legislature's site",
    ],
    stateBlockers: [],
  },
  NE: {
    change: {
      formName:
        "LLC: Statement of Change of Designated Office, Registered Agent and/or Registered Agent's Address (Limited Liability Company (Domestic)); Corporation: Domestic Change of Registered Agent and/or Office",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://sos.nebraska.gov/sites/default/files/doc/business-services/Corporations/Forms/StatementofChangeDLC.pdf",
          publisher: "Nebraska Secretary of State, Business Services",
          quote: "FILING FEE: $30.00 (In-Office) / $25.00 (Online)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.nebraska.gov/sites/default/files/doc/business-services/Corporations/Forms/DCChangeofAgent.pdf",
          publisher: "Nebraska Secretary of State, Business Services",
          quote:
            "DOMESTIC CHANGE OF REGISTERED AGENT and/or OFFICE ... FILING FEE: $30.00 (In-Office) $25.00 (Online) ... B. I hereby consent to act as registered agent for the above named corporation.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.nebraska.gov/business-services/new-fees-effective-july-1-2021",
          publisher: "Nebraska Secretary of State, Business Services",
          quote:
            "Subsequent business entity filing fees (amendment, change of agent, etc.) are $30 in-house",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Certificate of Organization (LLC) or the Articles of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://sos.nebraska.gov/business-services/new-business-information",
          publisher: "Nebraska Secretary of State, Business Services",
          quote:
            "The name of the registered agent and the location of the registered office must be listed",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.nebraska.gov/sites/default/files/doc/business-services/Corporations/Forms/CertificateOfOrganization.pdf",
          publisher: "Nebraska Secretary of State, Business Services",
          quote: "Name of the initial agent for service of process:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: null,
    provider: {
      url: "https://www.registeredagentsinc.com/nebraska/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in Nebraska.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Fees shown are the online (Corporate Document eDelivery) fees. In-office/paper fees are $5 higher for changes ($30) and $10 higher for formation ($110). Nebraska says portal fees still apply to online filings.",
      "Online filing is via eDelivery: the signed PDF form is uploaded with the fee.",
      "The domestic corporation change form contains an agent consent statement signed by the new agent; the domestic LLC Statement of Change form has no agent consent line.",
      "The $5 per page recording fee was eliminated effective July 1, 2021.",
    ],
    unverified: [
      "change.consentRequired: differs by entity type (corporation form includes the new agent's consent; LLC form does not), so left null",
      "Nebraska requires publishing notice of organization; cost not checked.",
      "Nebraska requires publishing notice of incorporation; cost not checked.",
    ],
    stateBlockers: [],
  },
  NH: {
    change: {
      formName:
        "Form 10 Statement of Change of Registered Office or Registered Agent or Both",
      governmentFeeCents: {
        llc: 1500,
        corporation: 1500,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.sos.nh.gov/corporations-0/forms-and-fees/limited-liability-companies",
          publisher: "New Hampshire Secretary of State, Corporation Division",
          quote:
            "Form 10 Statement of Change of Registered Office or Registered Agent or Both | $15",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://quickstart.sos.nh.gov/online/Home/FillingFee",
          publisher:
            "New Hampshire Secretary of State, QuickStart online filing system",
          quote:
            "Registered Agent Change - Domestic Limited Liability Company | $15.00 | $2 | $17.00 | N/A",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://quickstart.sos.nh.gov/online/Home/FillingFee",
          publisher:
            "New Hampshire Secretary of State, QuickStart online filing system",
          quote:
            "Registered Agent Change - Domestic Profit Corporation | $15.00 | $2 | $17.00 | N/A",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Certificate of Formation (Form LLC-1) for an LLC or the Articles of Incorporation (Form 11) for a corporation, filed to form the entity.",
      sources: [
        {
          url: "https://www.sos.nh.gov/sites/g/files/ehbemt561/files/documents/2023-12/form_llc-1_-10-2018.pdf",
          publisher: "New Hampshire Secretary of State, Corporation Division",
          quote:
            "THIRD: The name of the limited liability company's registered agent is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.nh.gov/sites/g/files/ehbemt561/files/inline-documents/sonh/domestic-form-11.pdf",
          publisher: "New Hampshire Secretary of State, Corporation Division",
          quote:
            "THIRD: The name of the corporation's initial registered agent is:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://www.sos.nh.gov/sites/g/files/ehbemt561/files/documents/2023-12/form_llc-1_-10-2018.pdf",
          publisher: "New Hampshire Secretary of State, Corporation Division",
          quote:
            "The total filing fee to register is $100.00, payable to the State of New Hampshire.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.nh.gov/sites/g/files/ehbemt561/files/inline-documents/sonh/domestic-form-11.pdf",
          publisher: "New Hampshire Secretary of State, Corporation Division",
          quote: "Filing fee: $100.00 Form 11",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://quickstart.sos.nh.gov/online/Home/FillingFee",
          publisher:
            "New Hampshire Secretary of State, QuickStart online filing system",
          quote:
            "Business Formation - Domestic Profit Corporation | $100.00 | $2 | $102.00 | N/A",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/new-hampshire/",
      publisher: "Registered Agents Inc.",
      quote:
        "New Hampshire Registered Agent ... You’ll find Registered Agents Inc in this list located in beautiful Derry, NH.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The QuickStart online fee table adds a $2 Handling Charge to each filing (columns: Filing Fee, Handling Charge, Total). Fees above are the state filing fee; online totals are $17 for a registered agent change and $102 for formation.",
      "Formation forms state the registered agent must reside in New Hampshire and the application will not be processed without an agent named or with an out of state address.",
      "The Form 10 PDF (form_10_-01-2023.pdf) and the corporation forms and fees page could not be loaded (site errors / robots block), so the agent consent requirement could not be read from the form itself. Form 10 applying to corporations is supported by the QuickStart corporation fee line rather than the corporation forms page.",
    ],
    unverified: [
      "change.consentRequired: Form 10 PDF could not be loaded; neither the LLC-1 nor Form 11 formation forms shows an agent consent requirement, but this was not confirmed for Form 10",
      "change.formName for corporations: corporation forms page could not be loaded; Form 10 confirmed on the LLC forms page only",
    ],
    stateBlockers: [],
  },
  NJ: {
    change: {
      formName:
        "Business Entity Amendment Filing (Form REG-C-EA), used for Change of Registered Office or Agent or Both",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.njportal.com/DOR/AnnualReports/Docs/regcea.pdf",
          publisher:
            "New Jersey Department of the Treasury, Division of Revenue and Enterprise Services",
          quote:
            "c. Filing fee for corporate and limited partnership agent changes is $25 per filing.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.njportal.com/DOR/AnnualReports/Docs/regcea.pdf",
          publisher:
            "New Jersey Department of the Treasury, Division of Revenue and Enterprise Services",
          quote:
            "d. Filing fee for limited liability company and limited liability partnership agent changes is $25 per filing.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.nj.gov/treasury/revenue/fees.shtml",
          publisher:
            "New Jersey Department of the Treasury, Division of Revenue and Enterprise Services",
          quote:
            "Change of Registered Office or Agent or Both (Also, includes resignation of agent)",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Public Records Filing for New Business Entity (the certificate of formation for an LLC or certificate of incorporation for a corporation) filed to form the entity.",
      sources: [
        {
          url: "https://www.nj.gov/treasury/revenue/pdf/Legacy-Reg-Form-0825.pdf",
          publisher:
            "New Jersey Department of the Treasury, Division of Revenue and Enterprise Services",
          quote: "Registered Agent - Enter one agent only.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.njportal.com/DOR/BusinessFormation/Home/Welcome",
          publisher:
            "New Jersey Department of the Treasury, Division of Revenue and Enterprise Services (NJ Online Business Entity Filing)",
          quote:
            "Registered Agent information (including Email Address to receive Registered Agent notifications)",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: null,
    provider: {
      url: "https://www.registeredagentsinc.com/new-jersey/",
      publisher: "Registered Agents Inc.",
      quote:
        "New Jersey Registered Agent ... Look no further, Registered Agents Inc is in New Jersey:",
      checkedAt: "2026-10-29",
    },
    notes: [
      "New Jersey's business filing office is the Division of Revenue and Enterprise Services (Treasury), not a Secretary of State.",
      "The DORES fee table (fees.shtml) lists the Certificate of incorporation and the LLC Certificate of formation at $100.00 each, while the Public Records Filing for New Business Entity instructions (revised 08/2025) say $125 per filing for all domestic for profit entities. The $125 figure from the formation filing packet is used here; operators should expect $125 when filing.",
      "Agent changes can be filed online through the NJ portal or on paper with Form REG-C-EA; the fee is $25 either way per the official sources.",
      "Expedited fees apply only to over the counter transactions per the DORES fee table.",
    ],
    unverified: [
      "change.consentRequired: neither Form REG-C-EA nor the formation instructions contain any agent consent language, but no official page states that consent is not required",
      "formation fees: two official DORES pages disagree ($100 certificate on the fee table versus $125 per filing on the formation packet); $125 reported",
      "Two official pages disagree on the formation fee ($100 or $125).",
      "Two official pages disagree on the formation fee ($100 or $125).",
    ],
    stateBlockers: [],
  },
  NM: {
    change: {
      formName:
        "Statement of change of registered office or registered agent (LLC: statement under NMSA 1978 Section 53-19-5(B); corporation: statement under NMSA 1978 Section 53-11-13); the SOS form title in the online portal was not confirmed",
      governmentFeeCents: {
        llc: 2000,
        corporation: 2500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-19-63",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-19-63",
          quote:
            "I. for filing a statement of change of address of registered office or registered agent, or both, twenty dollars ($20.00);",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-2-1",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-2-1",
          quote:
            "(6) filing a statement of a change of address of the registered office or change of the registered agent, or both, a fee of twenty-five dollars ($25.00);",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#a19",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-19-5",
          quote:
            "B. A limited liability company may change its registered office or registered agent by delivering to the commission [secretary of state] a statement setting forth:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#a19",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-19-5",
          quote:
            "(d) the statement of the successor registered agent that the agent accepts the appointment;",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-11-12",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-11-13",
          quote:
            "A. A corporation may change its registered office or change its registered agent, or both, upon filing in the office of the public regulation commission [secretary of state] a statement setting forth:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-11-12",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-11-13",
          quote:
            "(b) a statement executed by the successor registered agent acknowledging his acceptance of the appointment by the filing corporation as its registered agent",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The initial registered agent and registered office are named in the Articles of Organization (LLC) or the Articles of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-19-8",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-19-8 Articles of organization",
          quote:
            "B. the street address of the initial registered office and the name of the initial registered agent at that address",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-12-1",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-12-2 Articles of incorporation",
          quote:
            "(8) the address of its initial registered office and the name of its initial registered agent at the address;",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5000,
      },
      sources: [
        {
          url: "https://enterprise.sos.nm.gov/forms/business",
          publisher: "New Mexico Secretary of State, Business Services portal",
          quote:
            "Use this form to file an Articles of Organization for a Limited Liability Company. Non-Refundable Application Fee: $50.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://enterprise.sos.nm.gov/forms/business",
          publisher: "New Mexico Secretary of State, Business Services portal",
          quote:
            "Use this form to file Articles of Incorporation for a Domestic Profit Corporation. Non-Refundable Application Fee: Based on the number of shares; Minimum $100, Maximum $1,000",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-19-63",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-19-63",
          quote:
            "A. for filing the original articles of organization and issuing a certificate of organization, fifty dollars ($50.00);",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://nmonesource.com/nmos/nmsa/en/item/4400/index.do#!b/53-2-1",
          publisher:
            "New Mexico Compilation Commission (NMOneSource, official NMSA 1978), Section 53-2-1",
          quote:
            "a fee of one dollar ($1.00) for each one thousand shares of the total amount of authorized shares, but in no case less than one hundred dollars ($100) or more than one thousand dollars ($1,000);",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/new-mexico/",
      publisher: "Registered Agents Inc.",
      quote:
        "New Mexico Registered Agent ... Registered Agents Inc offers premium Registered Agent service, which includes biennial report compliance",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Change fees come from statute (LLC $20 under NMSA 53-19-63(I); corporation $25 under NMSA 53-2-1(A)(6)). The SOS forms portal lists only formation forms publicly; the change filing appears to be made after login in the SOS business portal, so its exact title and any portal convenience fee were not seen.",
      "Consent: both statutes require a statement from the successor registered agent accepting the appointment (LLC: 53-19-5(B)(4)(d); corporation: 53-11-13(A)(5)(b)).",
      "corpFeeCents for formation is the $100 minimum; the actual fee is $1.00 per 1,000 authorized shares, capped at $1,000.",
      "NMSA 53-2-1(E) lets the SOS set extra fees by rule for expedited service and card handling; none were read.",
      "nmonesource.com is published by the New Mexico Compilation Commission, the official publisher of New Mexico law; its text still says commission with the compiler's bracket [secretary of state].",
      "NMOneSource is a single page app; the URL fragments listed are the section links the site itself uses, and the quoted section is named in each publisher field.",
    ],
    unverified: [
      "change.formName: the SOS portal's own name for the change filing could not be seen without logging in",
      "Corporation formation fee rises with authorized shares ($100 minimum, $1,000 maximum).",
    ],
    stateBlockers: [],
  },
  NV: {
    change: {
      formName:
        "Statement of Change (registered agent change filed by the represented entity under NRS 77.340)",
      governmentFeeCents: {
        llc: 6000,
        corporation: 6000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.leg.state.nv.us/nrs/nrs-077.html",
          publisher:
            "Nevada Legislature, Nevada Revised Statutes Chapter 77 (Model Registered Agents Act)",
          quote:
            "A represented entity may change the information currently on file pursuant to NRS 77.310 by filing with the Secretary of State a statement of change signed on behalf of the entity",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.leg.state.nv.us/nrs/nrs-077.html",
          publisher:
            "Nevada Legislature, Nevada Revised Statutes Chapter 77 (Model Registered Agents Act)",
          quote: "For a statement of change, $60.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.leg.state.nv.us/nrs/nrs-077.html",
          publisher:
            "Nevada Legislature, Nevada Revised Statutes Chapter 77 (Model Registered Agents Act)",
          quote:
            "The appointment of a registered agent pursuant to paragraph (a) or (b) of subsection 1 must be accompanied by a certificate of acceptance of the appointment by the registered agent.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC) or Articles of Incorporation (corporation) filed to form the entity, and the agent signs the Certificate of Acceptance on that form.",
      sources: [
        {
          url: "https://bizhub.nv.gov/cms-webhook-bff/uploads/bizhub/LLC_Formation_V4_1_9e5c396592.pdf",
          publisher: "Nevada Secretary of State (Biz Hub)",
          quote:
            "This person must sign the Certificate of Acceptance in Section 2.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bizhub.nv.gov/cms-webhook-bff/uploads/bizhub/Profit_Corporation_Formation_V3_edited_0bfa162b6c.pdf",
          publisher: "Nevada Secretary of State (Biz Hub)",
          quote:
            "3a. Certificate of Acceptance of Appointment of Registered Agent",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: null,
    provider: {
      url: "https://www.registeredagentsinc.com/nevada/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in Nevada.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "nvsos.gov pages (forms and fees, registered agents) returned an Imperva/Incapsula bot check page and could not be read; the bot check was not worked around. Formation facts come from the Secretary of State's Biz Hub (bizhub.nv.gov) instruction PDFs. The change fee and consent requirement come from the Nevada Revised Statutes on the Legislature's official site, not from a Secretary of State page.",
      "Corporation formation fee of $75 is the minimum, for authorized share value of $75,000 or less; it rises with the value of authorized shares (par value times shares, or $1.00 per no par share), up to a maximum of $35,000.",
      "Formation in Nevada also requires an Initial List ($150) and a State Business License ($200 for an LLC, $500 for a corporation); these are not included in the formation fees above.",
      "If the registered agent cannot sign the formation form, a separate signed Registered Agent Acceptance form is attached (per the LLC formation instructions).",
    ],
    unverified: [
      "change.formName: the Secretary of State's own form title could not be loaded (nvsos.gov blocked by bot check); name is taken from NRS 77.340 wording",
      "change fees and consentRequired: confirmed from the official Nevada Revised Statutes (NRS 77.280 and 77.310) rather than a Secretary of State page, because nvsos.gov could not be loaded",
      "Formation also needs an Initial List ($150) and a State Business License ($200), not included.",
      "Formation also needs an Initial List and State Business License, and the fee rises with authorized share value.",
    ],
    stateBlockers: [],
  },
  NY: {
    change: {
      formName:
        "LLC: Certificate of Change (DOS-1359-f, under Section 211-A of the Limited Liability Company Law); Corporation: Certificate of Change (DOS-1556-f, under Section 805-A of the Business Corporation Law)",
      governmentFeeCents: {
        llc: 3000,
        corporation: 3000,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://dos.ny.gov/system/files/documents/2023/01/1359-f.pdf",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote:
            "The certificate must be submitted with a $30 filing fee made payable to the Department of State.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.ny.gov/system/files/documents/2023/01/1359-f.pdf",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote:
            "The limited liability company hereby changes the designation of its registered agent to:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.ny.gov/certificate-change-domestic-business-corporations-0",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote: "The certificate must be submitted with a $30 filing fee.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.ny.gov/certificate-change-domestic-business-corporations-0",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote:
            "The corporation hereby changes the designation of its registered agent to:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.ny.gov/fee-schedules",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote: "Change §805-A(a) or §1309-A(b) $30",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "New York does not require a registered agent at formation. The Articles of Organization (DOS-1336-f) or Certificate of Incorporation (DOS-2007-f) designate the Secretary of State as agent for service of process; an optional registered agent can be designated afterward by filing a Certificate of Change.",
      sources: [
        {
          url: "https://dos.ny.gov/system/files/documents/2023/01/1336-f.pdf",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote:
            "The Secretary of State is designated as agent of the limited liability company upon whom process",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.ny.gov/system/files/documents/2023/01/2007-f.pdf",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote:
            "The Secretary of State is designated as agent of the corporation upon whom process against the corporation may be served.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dos.ny.gov/certificate-change-domestic-business-corporations-0",
          publisher:
            "New York State Department of State, Division of Corporations",
          quote:
            "The corporation hereby designates its registered agent upon whom process against the corporation may be served.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: null,
    provider: {
      url: "https://www.registeredagentsinc.com/new-york/",
      publisher: "Registered Agents Inc.",
      quote:
        "New York Registered Agent ... We have offices in 52 jurisdictions and can help you in New York and beyond when your company expands to new markets.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "In New York a registered agent is optional. Every domestic LLC and corporation designates the Secretary of State as its agent for service of process in its formation document; the current DOS-1336-f and DOS-2007-f forms have no registered agent paragraph.",
      "The same Certificate of Change ($30) is used to designate, change or revoke a registered agent. A separate $5 Certificate of Change filed by the agent itself (Section 211-A(b) / 805-A(b), e.g. DOS-1672-f) only changes the agent's own address.",
      "New York LLCs must also meet the LLC publication requirement after formation (not covered here). Corporation formation may also involve an organization tax on authorized shares under the Tax Law, which the Department of State pages loaded did not state, so it is not included in the $125.",
      "No separate online fee was shown; DOS pages list the same fee regardless of filing method.",
    ],
    unverified: [
      "change.consentRequired: the Certificate of Change forms contain no agent consent line, but no official page states whether consent is required",
      "formation.corpFeeCents: organization tax on shares (if any) not confirmed on a loaded DOS page and not included",
      "New York LLCs must also publish notice of formation, a cost not covered by the state fee.",
      "A share-based organization tax may apply and was not confirmed.",
    ],
    stateBlockers: [],
  },
  OH: {
    change: {
      formName:
        "Written appointment of a new statutory agent with the agent's written acceptance (Secretary of State prescribed form, Form 521 Statutory Agent Update per search listing)",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-111.16",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 111.16 (Secretary of State filing fees)",
          quote:
            "(1) A change of agent, resignation of agent, or change of agent's address under section",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-1706.09",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 1706.09",
          quote:
            "A written acceptance of the appointment that is signed by the designated agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-1701.07",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 1701.07",
          quote:
            "A corporation may revoke the appointment of an agent by filing with the secretary of state",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-1701.07",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 1701.07",
          quote:
            "a written acceptance of the appointment that is either the original acceptance signed by the agent",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The statutory agent is appointed in a written appointment, with the agent's signed written acceptance, filed together with the original Articles of Organization (LLC) or Articles of Incorporation (corporation); the Secretary of State will not accept the articles without it.",
      sources: [
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-1701.07",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 1701.07",
          quote:
            "shall not accept original articles for filing unless there is filed with the articles a written appointment of an agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-1706.09",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 1706.09",
          quote:
            "shall not accept original articles of organization of a limited liability company",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 9900,
      },
      sources: [
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-111.16",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 111.16 (Secretary of State filing fees)",
          quote:
            "(F) For filing and recording articles of organization of a limited liability company,",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://codes.ohio.gov/ohio-revised-code/section-111.16",
          publisher:
            "Ohio Legislative Service Commission, Ohio Revised Code section 111.16 (Secretary of State filing fees)",
          quote:
            "provided no fee shall be less than ninety-nine dollars or greater than one hundred thousand dollars.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/ohio/",
      publisher: "Registered Agents Inc.",
      quote:
        "Registered Agents Inc is the premium choice for a registered agent in Ohio",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Every ohiosos.gov and sos.state.oh.us page and PDF tried (Business Filing Forms and Fee Schedule, Form 521, Form 532A, Form 533A, Business FAQ) failed to load (site client errors or robots block), so all facts here come from the Ohio Revised Code on the official codes.ohio.gov site rather than a Secretary of State page.",
      "Ohio uses the term statutory agent. ORC 111.16(R)(1) sets the change of agent fee at twenty five dollars. ORC 111.16(F) sets the LLC articles of organization fee at ninety nine dollars.",
      "Corporation formation fee: $99 is the minimum. ORC 111.16(A) charges ninety nine dollars for a corporation not authorized to issue shares and a per share schedule for corporations with authorized shares, with a floor of $99 and a cap of $100,000. A corporation with a larger number of authorized shares pays more.",
      "LLC agent change: ORC 1706.09(G) requires a new written appointment plus the new agent's signed acceptance and a statement revoking the former agent. Corporation agent change: ORC 1701.07(G) requires a written appointment of the new agent and a revocation statement; the acceptance requirement comes from 1701.07(B), which covers appointments other than with the original articles.",
      "The Secretary of State's form for agent changes is listed in search results as Form 521 (last revised 10/2024), but its title could not be read.",
    ],
    unverified: [
      "change.formName: Ohio SOS Form 521 PDF and the forms page could not be loaded; exact form title not confirmed",
      "all facts: confirmed only from the Ohio Revised Code (codes.ohio.gov), not from an ohiosos.gov page, because ohiosos.gov could not be loaded",
      "formation.corpFeeCents: $99 is the statutory minimum; actual fee depends on authorized shares",
      "Corporation formation fee is a minimum that rises with authorized shares.",
    ],
    stateBlockers: [],
  },
  OK: {
    change: {
      formName:
        "Change or Designation of Registered Agent and/or Registered Office (Oklahoma Corporation), SOS Form 0056; for an Oklahoma LLC: Change or Designation of Registered Agent and/or Registered Office and/or Principal Office (Oklahoma LLC), SOS Form 0075. Both can be filed online or on the PDF form.",
      governmentFeeCents: {
        llc: 2500,
        corporation: 2500,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.sos.ok.gov/business/forms.aspx",
          publisher: "Oklahoma Secretary of State, Business Services",
          quote:
            "Change or Designation of Registered Agent and/or Registered Office $25 Online PDF",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/business/forms.aspx",
          publisher: "Oklahoma Secretary of State, Business Services",
          quote:
            "Change or Designation of Registered Agent and/or Registered Office and/or Principal Office $25 Online PDF",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/forms/fm0056.pdf",
          publisher: "Oklahoma Secretary of State",
          quote:
            "CHANGE OR DESIGNATION OF REGISTERED AGENT AND/OR REGISTERED OFFICE (OKLAHOMA CORPORATION) Filing Fee: $25.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/forms/Fm0075.PDF",
          publisher: "Oklahoma Secretary of State",
          quote:
            "I hereby execute the following articles for the purpose of changing the registered agent and/or registered office and/or principal office of an Oklahoma limited liability company pursuant to the provisions of Title 18, Section 2010B",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/business/fees.aspx",
          publisher: "Oklahoma Secretary of State, Filing Fees",
          quote: "Change of Registered Agent and/or Office 25.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent and registered office are named in the Articles of Organization (LLC) or the Certificate of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://www.sos.ok.gov/forms/Fm0074.PDF",
          publisher:
            "Oklahoma Secretary of State (Procedures for Organizing an Oklahoma Limited Liability Company)",
          quote:
            "REGISTERED AGENT AND REGISTERED OFFICE - The name and street address of the registered agent in the state of Oklahoma.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/forms/Fm0001.PDF",
          publisher:
            "Oklahoma Secretary of State (Procedures for Organizing an Oklahoma Profit Corporation)",
          quote:
            "REGISTERED AGENT AND REGISTERED OFFICE - The name and street address of the registered agent in the state of Oklahoma.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
      },
      sources: [
        {
          url: "https://www.sos.ok.gov/business/fees.aspx",
          publisher: "Oklahoma Secretary of State, Filing Fees",
          quote: "Articles of Organization - Oklahoma LLC 18 OS 2055 100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/business/fees.aspx",
          publisher: "Oklahoma Secretary of State, Filing Fees",
          quote:
            "Certificate of Incorporation - Oklahoma For Profit Corporation 18 OS 1142 Min. 50.00(1/10 of 1%)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/forms/Fm0074.PDF",
          publisher: "Oklahoma Secretary of State",
          quote:
            "Pay to the Secretary of State a filing fee of One Hundred Dollars ($100.00). (Title 18, Section 2055)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.ok.gov/forms/Fm0001.PDF",
          publisher: "Oklahoma Secretary of State",
          quote:
            "If the TAC is $50,000.00 or less, the filing fee is $50.00. If the TAC is greater than $50,000.00, the fee is $1.00 per $1,000.00.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/oklahoma/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your Oklahoma registered agent, you receive the advantages of a national team",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The corporation formation fee is a minimum: $50.00 or one tenth of one percent of total authorized capital, whichever is greater; no par value stock is valued at $50.00 per share for fee purposes. corpFeeCents is that $50 minimum.",
      "Online and in person card payments carry a four percent (4%) service charge (Title 18, Section 1142), and in person filings add a $25.00 same day fee, per the SOS procedures PDFs. The government filing fee itself is the same online and on paper.",
      "Form 0056 is for Oklahoma corporations (cites Title 18, Section 1023); LLCs use Form 0075 (cites Title 18, Section 2010B). Both list $25.",
      "Neither change form has a signature or consent line for the new agent; Form 0056 must be signed by an authorized officer and Form 0075 by a manager. No official page loaded states a consent rule, so consentRequired is null.",
      "Earlier fetch tools were refused by sos.ok.gov; these pages were read in a browser on 2026-10-29.",
    ],
    unverified: [
      "change.consentRequired: the forms carry no agent consent section and no official text addressing consent was found",
      "Corporation formation fee is a $50 minimum that rises with authorized capital.",
    ],
    stateBlockers: [],
  },
  OR: {
    change: {
      formName: "Corporation/Limited Liability Company - Information Change",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://sos.oregon.gov/business/Documents/business-registry-forms/br-fee-schedule.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "Change of Registered Agent/Address (Corp/LLC) $0.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.oregon.gov/business/documents/business-registry-forms/general-aar.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "THE REGISTERED AGENT HAS BEEN CHANGED TO:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.oregon.gov/business/documents/business-registry-forms/general-aar.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "No Processing Fee",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.oregon.gov/business/documents/business-registry-forms/general-aar.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "THE NEW REGISTERED AGENT HAS CONSENTED TO THIS APPOINTMENT.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC) or Articles of Incorporation (business corporation) filed to form the entity.",
      sources: [
        {
          url: "https://sos.oregon.gov/business/documents/business-registry-forms/llc-articles.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote:
            "4. REGISTERED AGENT: (Individual or entity that will accept legal service",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.oregon.gov/business/Documents/business-registry-forms/dbc-articles.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote:
            "3. REGISTERED AGENT: (Individual or entity that will accept legal",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://sos.oregon.gov/business/Documents/business-registry-forms/br-fee-schedule.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "Articles of Organization $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.oregon.gov/business/Documents/business-registry-forms/br-fee-schedule.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "Articles of Incorporation $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.oregon.gov/business/documents/business-registry-forms/llc-articles.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "Required Processing Fee $100",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.oregon.gov/business/Documents/business-registry-forms/dbc-articles.pdf",
          publisher:
            "Oregon Secretary of State, Corporation Division (Business Registry)",
          quote: "Required Processing Fee $100",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/oregon/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc, for $200 a year you get a dedicated registered agent at a local Oregon office.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Changing the registered agent is free in Oregon for both corporations and LLCs.",
      "The Information Change form contains a statement that the new registered agent has consented; there is no separate agent signature line, the filer attests to the consent.",
      "The fee schedule lists one fee per filing and does not distinguish online from paper.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  PA: {
    change: {
      formName:
        "Statement or Certificate of Change of Registered Office (DSCB:15-1507/5507/8625/8825), listed on the fee schedule as Change of Registered Office",
      governmentFeeCents: {
        llc: 500,
        corporation: 500,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://www.pa.gov/agencies/dos/programs/business/fees-and-payments",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote: "Change of Registered Office | $5",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/programs/business/forms/offsite-forms/15-1507_5507_8625_8825-Statement-of-Chng-of-Registered-Office.pdf",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote: "The nonrefundable filing fee for this form is $5.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/programs/business/forms/offsite-forms/15-1507_5507_8625_8825-Statement-of-Chng-of-Registered-Office.pdf",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote: "Name of Commercial Registered Office Provider",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/agencies/dos/programs/business/information-services/commercial-registered-office-providers",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote:
            "Prior to listing a CROP address, the association should enter into a contract for the services of the Commercial Registered Office Provider.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "Pennsylvania has no registered agent; the registered office address, or the name of a Commercial Registered Office Provider and county of venue, is given in item 2 of the Certificate of Organization (LLC, DSCB:15-8821) or Articles of Incorporation, For Profit (DSCB:15-1306) filed to form the entity.",
      sources: [
        {
          url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/programs/business/forms/offsite-forms/15-8821-Cert-of-Org-Dom-LLC.pdf",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote:
            "(b) The name of this limited liability company’s commercial registered office provider and county of venue",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/programs/business/forms/offsite-forms/15-1306-Art-of-Incorp-For-Profit.pdf",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote:
            "(b) The name of this corporation's commercial registered office provider and the county of venue is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/agencies/dos/programs/business/information-services/commercial-registered-office-providers",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote:
            "A Commercial Registered Office Provider (CROP) is not the same as a Registered Agent.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 12500,
      },
      sources: [
        {
          url: "https://www.pa.gov/agencies/dos/programs/business/fees-and-payments",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote: "Certificate of Organization | $125",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/agencies/dos/programs/business/fees-and-payments",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote:
            "Articles of Incorporation or like instrument incorporating a corporation or association | $125",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/programs/business/forms/offsite-forms/15-8821-Cert-of-Org-Dom-LLC.pdf",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote: "Fee: $125",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.pa.gov/content/dam/copapwp-pagov/en/dos/programs/business/forms/offsite-forms/15-1306-Art-of-Incorp-For-Profit.pdf",
          publisher:
            "Pennsylvania Department of State, Bureau of Corporations and Charitable Organizations",
          quote: "Fee: $125",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/pennsylvania/",
      publisher: "Registered Agents Inc.",
      quote:
        "Pennsylvania Registered Agent ... When you hire Registered Agents Inc as your Pennsylvania registered office,",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Pennsylvania uses a registered office, not a registered agent. To move to a CROP, file the Statement of Change of Registered Office and write the provider's name after 'c/o:' on the line 'Name of Commercial Registered Office Provider'.",
      "CROP check: 'Registered Agents Inc' appears on the Department of State's Commercial Registered Office Providers list (alphabetical list on the page itself, under R): 'Registered Agents Inc, 502 West 7th Street, Suite 100, Erie, PA 16502, 307-200-2803'. Source: https://www.pa.gov/agencies/dos/programs/business/information-services/commercial-registered-office-providers",
      "The CROP page says: 'Listing a Commercial Registered Office Provider (CROP) in lieu of providing a registered office address is an option' and 'Commercial Registered Office Providers may not be used for filings in which a principal place of business is required.'",
      "No CROP consent form is filed; the Department says the entity should contract with the CROP before listing it. For corporations the change form states 'Such change was authorized by the Board of Directors of the corporation.'",
      "The fee schedule shows no online vs paper difference for these filings; expedited service fees are separate.",
    ],
    unverified: [
      "change.consentRequired: no official statement that the CROP must consent in the filing; only that the entity should contract with the CROP first",
      "Pennsylvania corporations must advertise the incorporation; cost not checked.",
    ],
    stateBlockers: [],
  },
  PR: {
    change: {
      formName:
        "Certificado de Cambio del Agente Residente de una Corporación / Certificate of Change of Resident Agent of a Corporation (22-CORPOTR05)",
      governmentFeeCents: {
        corporation: 6000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.statedepartment.pr.gov/forms-for-corporation",
          publisher:
            "Puerto Rico Department of State (Departamento de Estado), Registry of Corporations",
          quote:
            "Change of Resident Agent of a Corporation | CF - $60.00, SF - $4.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/22-CORPOTR05.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote: "CERTIFICATE OF CHANGE OF RESIDENT AGENT OF A CORPORATION",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/22-CORPOTR05.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote: "5133 - $24.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/22-CORPOTR05.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote: "5134 - $36.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/22-CORPOTR05.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote:
            "The written consent of the new resident agent shall appear in this certificate or attached hereto.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Corporaciones%20Privadas/164-2009/164-2009.pdf#page=159",
          publisher:
            "Oficina de Gerencia y Presupuesto de Puerto Rico, Ley General de Corporaciones (Ley 164-2009, según enmendada), Artículo 19.04",
          quote:
            "Toda compañía de responsabilidad limitada tendrá y mantendrá en Puerto Rico una oficina registrada y un agente residente conforme a lo dispuesto en el Capítulo III de esta Ley.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Corporaciones%20Privadas/164-2009/164-2009.pdf",
          publisher:
            "Oficina de Gerencia y Presupuesto de Puerto Rico, Ley General de Corporaciones (Ley 164-2009), Artículo 3.03",
          quote:
            "sustituir al agente residente por otra persona natural o jurídica.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Corporaciones%20Privadas/164-2009/164-2009.pdf",
          publisher:
            "Oficina de Gerencia y Presupuesto de Puerto Rico, Ley General de Corporaciones (Ley 164-2009), Artículo 3.03",
          quote:
            "una copia certificada indicadora del cambio deberá radicarse en las oficinas del Departamento de Estado.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Corporaciones%20Privadas/164-2009/164-2009.pdf#page=162",
          publisher:
            "Oficina de Gerencia y Presupuesto de Puerto Rico, Ley General de Corporaciones (Ley 164-2009), Artículo 19.12",
          quote:
            "al igual que su enmienda, cancelación, reafirmación y el restablecimiento de la personalidad jurídica de una compañía de responsabilidad limitada se hará conforme a los términos y requisitos establecidos en esta Ley para las corporaciones.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.statedepartment.pr.gov/forms-for-corporation",
          publisher:
            "Puerto Rico Department of State (Departamento de Estado), Registry of Corporations",
          quote:
            "CF - $60.00 SF - $4.00 Change of Resident Agent of a Corporation",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.statedepartment.pr.gov/forms-for-corporation",
          publisher:
            "Puerto Rico Department of State (Departamento de Estado), Registry of Corporations",
          quote:
            "$80.00 Certificate of Amendment of the Certificate of Organization",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/43-CORPLLC11.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote:
            "CERTIFICADO DE ENMIENDA AL CERTIFICADO DE ORGANIZACION DE UNA COMPAÑÍA DE RESPONSABILIDAD LIMITADA",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The resident agent and designated office are named in the Certificate of Formation (Certificado de Organización, LLC) or the Certificate of Incorporation (Certificado de Incorporación, corporation) filed to form the entity.",
      sources: [
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/34-CORPLLC02.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote: "The Resident Agent in charge of said office is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/1-CORPREG01.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote:
            "SECOND: Its designated office in the Government of Puerto Rico will be located at",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://bvirtualogp.pr.gov/ogp/Bvirtual/leyesreferencia/PDF/Corporaciones%20Privadas/164-2009/164-2009.pdf",
          publisher:
            "Oficina de Gerencia y Presupuesto de Puerto Rico (Ley General de Corporaciones, Ley 164-2009)",
          quote: "el nombre del agente residente en dicha oficina",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 25000,
        corporation: 15000,
      },
      sources: [
        {
          url: "https://www.statedepartment.pr.gov/forms-for-corporation",
          publisher:
            "Puerto Rico Department of State (Departamento de Estado), Registry of Corporations",
          quote: "Certificate of Formation | $250.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.statedepartment.pr.gov/forms-for-corporation",
          publisher:
            "Puerto Rico Department of State (Departamento de Estado), Registry of Corporations",
          quote: "Application for Registration: Stock Corporation | $150.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/34-CORPLLC02.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote: "4391 - $150.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.pr.gov/files/Estado/Corporaciones/Formularios/1-CORPREG01.pdf",
          publisher: "Puerto Rico Department of State (Departamento de Estado)",
          quote: "5133 - $60.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/puerto-rico/",
      publisher: "Registered Agents Inc.",
      quote:
        "Hire a Puerto Rico registered agent service and get your legal correspondence and business mail delivered fast",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Corporation change fee $60.00 is the sum of two revenue codes on form 22-CORPOTR05 (5133 $24.00 plus 5134 $36.00); the forms page lists CF $60.00 and SF $4.00 (SF appears to be the nonprofit cost, the form says nonprofit transactions cost $4.00).",
      "LLC formation $250.00 is revenue codes 4391 $150.00 plus 4392 $100.00; corporation formation $150.00 is 5133 $60.00 plus 5134 $90.00.",
      "Puerto Rico uses the term resident agent (agente residente) and designated office (oficina designada).",
      "The Department of State forms page lists no LLC specific change of resident agent form; the corporation change form 22-CORPOTR05 is labeled for corporations only.",
      "Filings are made through the online Registry of Corporations (prcorpfiling.f1hst.com); online fees were not separately listed on the pages checked.",
      "Not resolved for LLCs. Article 19.04 sends LLC resident agent matters to Chapter III (the corporation rules), and Article 3.03 lets the entity replace its resident agent and file a certified copy of the change with the Department of State. That points to the change of resident agent certificate (22-CORPOTR05, $60.00) rather than an amendment, but the Department's forms page files that form under corporations only and its LLC table has no change of agent row.",
      "The other possible route for an LLC is the Certificate of Amendment of the Certificate of Organization (43-CORPLLC11), $80.00 (revenue codes R-4391 $50.00 and R-4392 $30.00), since the certificate of organization names the resident agent. The amendment form itself does not mention the resident agent and cites no article.",
    ],
    unverified: [
      "change.llcFeeCents: no LLC change of resident agent form or fee was found on the Department of State forms page; the LLC may need a Certificate of Amendment of the Certificate of Organization ($80.00) or an online registry update, but no official page confirming which was loaded.",
      "change.consentRequired applies to the corporation form; LLC consent requirement not confirmed.",
    ],
    stateBlockers: [],
  },
  RI: {
    change: {
      formName:
        "Statement of Change of Agent (Form 640 for business corporations; Form 642 for limited liability companies)",
      governmentFeeCents: {
        llc: 2000,
        corporation: 2000,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/business-forms-fee-schedule.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote: "640 CHANGE OF AGENT YES $20.00 $2.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/business-forms-fee-schedule.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote: "642 CHANGE OF AGENT YES $20.00 $2.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/640-change-of-registered-agent-business-corporation.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote: "Filing Fee: $20.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/642-change-of-registered-agent-limited-liability-company.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote: "Filing Fee: $20.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/642-change-of-registered-agent-limited-liability-company.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote:
            "An Authorized Person of the limited liability company MUST sign and date the form.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent (called resident agent for LLCs) is named in the Articles of Incorporation (Form 100) or Articles of Organization (Form 400) filed to form the entity.",
      sources: [
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/400-articles-of-organization.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote:
            "2. The name and address of the initial resident agent/office in Rhode Island is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/100-articles-of-incorporation.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote:
            "The name and address of the initial registered agent/office in Rhode Island is",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 15000,
      },
      sources: [
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/business-forms-fee-schedule.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote: "400 ARTICLES OF ORGANIZATION YES $150.00 $6.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/business-forms-fee-schedule.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote:
            "100 ARTICLES OF INCORPORATION (UNDER 75,000,000 SHARES) YES $230.00 $8.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/100-articles-of-incorporation.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote:
            "Corporations formed with less than 75 million authorized shares must pay the minimum filing fee of $230.00.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://docs.sos.ri.gov/documents/BusinessServices/400-articles-of-organization.pdf",
          publisher:
            "Rhode Island Department of State, Business Services Division",
          quote: "Filing Fee: $150.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/rhode-island/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your Rhode Island registered agent",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The fee schedule has a second column headed 'Enhanced Fee' ($2.00 on change of agent, $6.00 on LLC articles, $8.00 on corporate articles). The page does not define it; it may be an added charge for online filing. Confirm with the office before quoting a total.",
      "Corporate formation fee of $230 is the minimum for under 75,000,000 authorized shares; larger share counts cost more under RIGL 7-1.2-1602.",
      "Form 640A (change of registered office only) is listed as NO FEE for business corporations.",
      "The change forms require only the entity's authorized officer or authorized person to sign; no agent signature line was found on the forms.",
    ],
    unverified: [
      "change.consentRequired: neither change form nor fee schedule states whether the new agent's consent is required; statute not checked",
      "Corporation formation fee rises with authorized shares.",
    ],
    stateBlockers: [],
  },
  SC: {
    change: {
      formName:
        "LLC: Notice of Change of Designated Office, Agent or Address of Registered Agent (Form F0080, S.C. Code 33-44-109); Corporation: Notice of Change of Registered Office or Registered Agent or Both of a South Carolina Corporation (Form F0077, S.C. Code 33-5-102)",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0080&entityType=2&filingType=Notice%20of%20Change%20of%20Designated%20Office%2C%20Agent%20or%20Address%20of%20Registered%20Agent",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote: "$10.00 made payable to the Secretary of State's Office",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0080&entityType=2&filingType=Notice%20of%20Change%20of%20Designated%20Office%2C%20Agent%20or%20Address%20of%20Registered%20Agent",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote: "I hereby consent to the appointment as registered agent.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0077&entityType=1&filingType=Notice+of+Change+of+Registered+Office+or+Registered+Agent+or+Both+of+a+South+Carolina+Corporation",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote:
            "$10.00 filing fee made payable to the South Carolina Secretary of State.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0077&entityType=1&filingType=Notice+of+Change+of+Registered+Office+or+Registered+Agent+or+Both+of+a+South+Carolina+Corporation",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote:
            "I hereby consent to the appointment as registered agent of the corporation:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Home/DownloadForms?pdfCategoryId=8",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote:
            "Notice of Change of Designated Office, Agent or Address of Registered Agent (§33-44-109), $10.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC, as the initial agent for service of process) or Articles of Incorporation (corporation) filed to form the entity, with the agent's signature on the form.",
      sources: [
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0006&entityType=2&filingType=Articles+of+Organization",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote: "The initial agent for service of process is",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0001&entityType=1&filingType=Articles+of+Incorporation",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote: "And the initial registered agent at such address is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0001&entityType=1&filingType=Articles+of+Incorporation",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote:
            "I hereby consent to the appointment as registered agent of the corporation",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 11000,
        corporation: 13500,
      },
      sources: [
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Home/DownloadForms?pdfCategoryId=1&category=Starting+a+Business+in+South+Carolina",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote:
            "You must submit a total payment of $135 which includes the $25 fee for the CL-1 Form. $110.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://businessfilings.sc.gov/BusinessFiling/Entity/DownloadForm?formName=F0001&entityType=1&filingType=Articles+of+Incorporation",
          publisher:
            "South Carolina Secretary of State, Business Entities Division",
          quote: "The $25 CL-1 fee is included in the $135 filing fee.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/south-carolina/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your South Carolina registered agent,",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Corporation formation total is $135 paid to the Secretary of State: $110 Articles of Incorporation fee plus the $25 CL-1 (Initial Annual Report of Corporations) fee. Use $110 if only the Secretary of State filing fee is wanted.",
      "LLC Articles of Organization fee is $110 per the Secretary of State downloadable forms page; the F0006 form text itself did not show a legible fee amount.",
      "Both change forms carry a consent statement signed by the new registered agent; the corporation form also allows the agent's written consent to be attached.",
      "A $2.00 fee applies when a corporation's registered agent files a change limited to the registered office street address (per F0077 instructions).",
    ],
    unverified: [],
    stateBlockers: [],
  },
  SD: {
    change: {
      formName:
        "Statement of Change of Registered Agent and/or Address (form titled STATEMENT OF CHANGE OF REGISTERED OFFICE OR REGISTERED AGENT OR BOTH)",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://sdsos.gov/general-information/filing-fees.aspx",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "Statement of Change of Registered Agent and/or Address | $10",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sdsos.gov/general-information/filing-fees.aspx",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "Paper Filing Fee for documents able to be filed online",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sdsos.gov/docs/business/statementofchangeLLC20180215.pdf",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote:
            "STATEMENT OF CHANGE OF REGISTERED OFFICE OR REGISTERED AGENT OR BOTH",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sdsos.gov/docs/business/statementofchangeLLC20180215.pdf",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "FILING FEE: $25",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC) or Articles of Incorporation (business corporation) filed to form the entity, either a noncommercial agent or a commercial registered agent identified by CRA number.",
      sources: [
        {
          url: "https://sdsos.gov/docs/business/llc-domestic-articlesoforganization.pdf",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "The South Dakota Registered Agent's name:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sdsos.gov/docs/business/corporation-domestic-articlesofincorporation.pdf",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "The South Dakota Registered Agent’s name:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 15000,
        corporation: 15000,
      },
      sources: [
        {
          url: "https://sdsos.gov/general-information/filing-fees.aspx",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "Filed Electronically online | $150",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sdsos.gov/general-information/filing-fees.aspx",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "Filed via Paper (includes paper filing fee) | $165",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sdsos.gov/docs/business/llc-domestic-articlesoforganization.pdf",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "FILING FEE: $165 (includes $15 paper filing fee)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sdsos.gov/docs/business/corporation-domestic-articlesofincorporation.pdf",
          publisher:
            "South Dakota Secretary of State, Division of Business Services",
          quote: "FILING FEE: $165",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/south-dakota/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your South Dakota registered agent",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Formation fees are the online fees: $150 online, $165 on paper for both Domestic Articles of Organization and Domestic Articles of Incorporation.",
      "Statement of Change is $10 per the fee schedule (online filing at sosenterprise.sd.gov). The paper PDF form states $25, which matches $10 plus the $15 'Paper Filing Fee for documents able to be filed online'.",
      "The change form and the formation forms have no agent consent statement or agent signature line; only an authorized officer or organizer signs.",
    ],
    unverified: [
      "change.consentRequired: forms and fee schedule do not address agent consent; statute (SDCL 59-11-11) not checked",
    ],
    stateBlockers: [],
  },
  TN: {
    change: {
      formName:
        "Statement of Change of Registered Agent by Entity (SS-4534), filed online through TNCaB (tncab.tnsos.gov) or on the paper form",
      governmentFeeCents: {
        llc: 2000,
        corporation: 2000,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://sos.tn.gov/businesses/services/business-forms-fees",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations (Business Forms & Fees)",
          quote:
            "Statement of Change of Registered Agent/Office by Entity or Agent (PDF, 270.5KB) SS-4534 $20",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/SS-4534.pdf?VersionId=ujACRQyLNNVtzYsotVRBA5AIWTyr4k2C",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations",
          quote:
            "A business entity may change its Registered Agent by filing a Statement of Change of Registered Agent.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/SS-4534.pdf?VersionId=ujACRQyLNNVtzYsotVRBA5AIWTyr4k2C",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations",
          quote:
            "Pursuant to the provisions of T.C.A. § 48-15-102 or § 48-25-108 of the Tennessee Business Corporation Act, T.C.A. § 48-55-102 or § 48-65-108 of the Tennessee Nonprofit Corporation Act, T.C.A. § 48-208-102 of the Tennessee Limited Liability Company Act, T.C.A. § 48-249-110 of the Tennessee Revised Limited Liability Company Act",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/SS-4534.pdf?VersionId=ujACRQyLNNVtzYsotVRBA5AIWTyr4k2C",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations",
          quote:
            "The filing fee for Statement of Change of Registered Agent by Entity is $20.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://tnbear.tn.gov/Ecommerce/RAChangeInstr.aspx",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations (Business Services Online)",
          quote: "The filing fee is $20.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://tnbear.tn.gov/Ecommerce/RAChangeInstr.aspx",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations (Business Services Online)",
          quote: "online service fee may be added to the filing fee.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The initial registered agent and office are named in the Articles of Organization (LLC, Form SS-4270) or the Charter (for profit corporation, Form SS-4417) filed to form the entity.",
      sources: [
        {
          url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/SS-4270%20LLC_0.pdf?VersionId=SHQcvmBKLxqwiWe3Ficu3Iv3gOHscm6X",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations",
          quote:
            "17. The name, complete address, and email of the initial registered agent and office located in the state of Tennessee is:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/SS-4417%20Charter%20For-Profit_0.pdf?VersionId=7EoQqZ9wQioAfzxr30fLXGI1MD2HhuUh",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations",
          quote:
            "16. The name, complete address, and email address of the initial registered agent and office located in the state of Tennessee is:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        corporation: 10000,
      },
      sources: [
        {
          url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/SS-4270%20LLC_0.pdf?VersionId=SHQcvmBKLxqwiWe3Ficu3Iv3gOHscm6X",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations",
          quote:
            "Filing Fee: $50.00 per member (minimum fee = $300/maximum fee = $3,000)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.tn.gov/businesses/services/business-forms-fees",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations (Business Forms & Fees)",
          quote:
            "Articles of Organization Limited Liability Company (PDF, 294.3KB) SS-4270 $300*",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/SS-4417%20Charter%20For-Profit_0.pdf?VersionId=7EoQqZ9wQioAfzxr30fLXGI1MD2HhuUh",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations",
          quote: "Filing Fee: $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.tn.gov/businesses/services/business-forms-fees",
          publisher:
            "Tennessee Secretary of State, Division of Business and Charitable Organizations (Business Forms & Fees)",
          quote: "Charter For-Profit Corporation (PDF, 285.2KB) SS-4417 $100",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/tennessee/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your Tennessee registered agent,",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Conflict resolved: an existing LLC or corporation changes its registered agent with the Statement of Change of Registered Agent by Entity (SS-4534, $20), not Articles of Amendment. The SS-4534 form cites the change of agent sections of both the Business Corporation Act (48-15-102) and the Revised LLC Act (48-249-110), and its instructions say a business entity may change its agent by filing it. The Business Forms & Fees page lists SS-4534 at $20 under Domestic Corporations and under Domestic LLCs. The sos.tn.gov FAQ line quoted in the main TN.json (agent change requires Articles of Amendment) was not re-read here and does not match the current forms.",
      "LLC formation fee is $50 per member, minimum $300 and maximum $3,000; llcFeeCents is the $300 minimum (1 to 6 members).",
      "Card and e-check payments online or in person add a convenience fee; mailing the paper form with a check avoids it (SS-4534 instructions). Online filing has moved to TNCaB (tncab.tnsos.gov) per the SS-4534 instructions.",
      "The SS-4534 asks for the new agent's name, address and business email, and the filer acknowledges the registered office and agent's business office will be identical; it has no consent or signature line for the new agent.",
      "The online Registered Agent Change page shows a $20 filing fee plus a possible online service fee; its payment step shows $22.25, so the online card or eCheck total is about $2.25 more than the $20 statutory fee. Mailing the printed form avoids the service fee.",
      "The online Registered Agent Change page says a registered agent or a business representative may file for any business entity it is registered for; it does not distinguish LLCs and corporations, so the $20 fee is applied to both.",
      "A registered agent change can also be made on the annual report: 'an additional $20 is required if any change is made concerning the registered agent/registered office' (sos.tn.gov FAQ).",
    ],
    unverified: [
      "change.consentRequired: SS-4534 neither requires nor mentions the new agent's consent; the statute text (T.C.A. 48-15-102, 48-249-110) was not read",
      "LLC formation fee is $50 per member ($300 minimum, $3,000 maximum).",
    ],
    stateBlockers: [],
  },
  TX: {
    change: {
      formName: "Statement of Change of Registered Office/Agent (Form 401)",
      governmentFeeCents: {
        llc: 1500,
        corporation: 1500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.state.tx.us/corp/instructions/401.shtml",
          publisher:
            "Texas Secretary of State, Business & Public Filings Division",
          quote:
            "The filing fee for a change of registered office/agent is $15.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.tx.us/corp/instructions/401.shtml",
          publisher:
            "Texas Secretary of State, Business & Public Filings Division",
          quote:
            "a person designated as the registered agent of an entity must have consented, either in a written or electronic form,",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://direct.sos.state.tx.us/help/help-corp.asp?pg=fee-revised",
          publisher: "Texas Secretary of State, SOSDirect Fee Schedule",
          quote: "Change of Registered Agent/Office 15.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://direct.sos.state.tx.us/help/help-corp.asp?pg=fee-revised",
          publisher: "Texas Secretary of State, SOSDirect Fee Schedule",
          quote:
            "Fees same as domestic and foreign for-profit corporation filing fees. (Sections 4.151 & 4.154, BOC)",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in Article 2 of the Certificate of Formation (Form 205 for an LLC, Form 201 for a for-profit corporation) filed to form the entity, with the organizer or incorporator affirming the agent's consent.",
      sources: [
        {
          url: "https://www.sos.state.tx.us/corp/forms/205_boc.pdf",
          publisher:
            "Texas Secretary of State, Business & Public Filings Division",
          quote: "Article 2 - Registered Agent and Registered Office",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.tx.us/corp/forms/201_boc.pdf",
          publisher:
            "Texas Secretary of State, Business & Public Filings Division",
          quote: "Article 2 - Registered Agent and Registered Office",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.tx.us/corp/forms/205_boc.pdf",
          publisher:
            "Texas Secretary of State, Business & Public Filings Division",
          quote:
            "The undersigned affirms that the person designated as registered agent has consented to the appointment.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 30000,
        corporation: 30000,
      },
      sources: [
        {
          url: "https://www.sos.state.tx.us/corp/forms/205_boc.pdf",
          publisher:
            "Texas Secretary of State, Business & Public Filings Division",
          quote: "Filing Fee: $300",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.state.tx.us/corp/forms/201_boc.pdf",
          publisher:
            "Texas Secretary of State, Business & Public Filings Division",
          quote: "Filing Fee: $300",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://direct.sos.state.tx.us/help/help-corp.asp?pg=fee-revised",
          publisher: "Texas Secretary of State, SOSDirect Fee Schedule",
          quote: "Certificate of Formation 300.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/texas/",
      publisher: "Registered Agents Inc.",
      quote:
        "Texas Registered Agent ... Registered Agents Inc makes maintaining your business in Texas as easy as possible with the following benefits:",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Form 401 is used when the only change is to the registered agent or registered office. The new agent's written or electronic consent must exist, but a copy need not be submitted with the statement of change.",
      "The SOSDirect fee schedule says LLC fees are the same as for-profit corporation fees, so the $15 change fee and $300 formation fee apply to both.",
      "Online filing through SOSDirect may add a convenience fee; not checked.",
    ],
    unverified: [],
    stateBlockers: [],
  },
  UT: {
    change: {
      formName:
        "Registration Information Change Form (Limited Liability Company Registration Information Change Form; Corporation Registration Information Change Form), or an online change in the Business Registration System",
      governmentFeeCents: {
        llc: 1700,
        corporation: 1700,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://commerce.utah.gov/wp-content/uploads/2023/04/llcricf.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code",
          quote: "Non-Refundable Processing Fee: $17.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://commerce.utah.gov/wp-content/uploads/2023/04/corpricf.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code",
          quote: "Non-Refundable Processing Fee: $17.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://commerce.utah.gov/wp-content/uploads/2023/04/currentfees.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code (Fiscal Year 2026 Fee Schedule)",
          quote: "Online changes $17",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://commerce.utah.gov/corporations/business-registration-information-changes/",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code",
          quote: "You may make changes to your business entity online.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Certificate of Organization (LLC) or Articles of Incorporation (Profit) filed to form the entity.",
      sources: [
        {
          url: "http://commerce.utah.gov/wp-content/uploads/2023/04/llcdomestic-1.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code",
          quote:
            "3. The name of the Registered Agent (Individual or Business Entity or Commercial Registered Agent):",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://commerce.utah.gov/wp-content/uploads/2023/04/incprofit.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code",
          quote:
            "4. Who/What is the name of the Registered Agent (Individual or Business Entity or Commercial Registered Agent)?:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 5900,
        corporation: 5900,
      },
      sources: [
        {
          url: "https://commerce.utah.gov/wp-content/uploads/2023/04/currentfees.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code (Fiscal Year 2026 Fee Schedule)",
          quote:
            "Limited liability company (LLC) - certificate of organization $59",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://commerce.utah.gov/wp-content/uploads/2023/04/currentfees.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code (Fiscal Year 2026 Fee Schedule)",
          quote: "Business corporation - articles of incorporation $59",
          checkedAt: "2026-10-29",
        },
        {
          url: "http://commerce.utah.gov/wp-content/uploads/2023/04/llcdomestic-1.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code",
          quote: "Non-Refundable Processing Fee: $59.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://commerce.utah.gov/wp-content/uploads/2023/04/incprofit.pdf",
          publisher:
            "Utah Department of Commerce, Division of Corporations and Commercial Code",
          quote: "Non-Refundable Processing Fee: $59.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/utah/",
      publisher: "Registered Agents Inc.",
      quote:
        "Utah Registered Agent ... Registered Agents Inc offers a range of enhanced services beyond the basic state requirements in Utah",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The fee schedule loaded is titled 'Fiscal Year 2026 Fee Schedule, Effective July 1, 2025'. Today falls in fiscal year 2027; no FY2027 schedule was found on commerce.utah.gov, so confirm fees have not changed since July 1, 2026.",
      "The fee schedule lists 'Change form $17' and 'Online changes $17' under '5. Amendment and Change Filings'; paper and online cost the same.",
      "The separate 'Commercial Registered Agent Changes' filing ($52) is for a commercial registered agent changing its own name or address, not for an entity switching agents.",
      "Neither change form nor the formation forms contain an agent consent statement or agent signature line.",
    ],
    unverified: [
      "change.consentRequired: Utah's change forms and change page do not say whether the new agent's consent is required; statute not checked",
    ],
    stateBlockers: [],
  },
  VA: {
    change: {
      formName:
        "Statement of Change of Registered Office and/or Registered Agent (Form LLC1016 for LLCs; Form SCC635/834 for stock corporations)",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: null,
      sources: [
        {
          url: "https://scc.virginia.gov/pages/Virginia-Limited-Liability-Companies",
          publisher: "Virginia State Corporation Commission, Clerk's Office",
          quote:
            "Update your Registered Office Address or Change your Registered Agent (LLC1016) | No Fee | File Online or Request a Form",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://scc.virginia.gov/pages/Virginia-Stock-Corporations",
          publisher: "Virginia State Corporation Commission, Clerk's Office",
          quote:
            "Update your Registered Office Address or Change your Registered Agent (SCC635/834)",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://law.lis.virginia.gov/vacode/title13.1/chapter9/section13.1-635/",
          publisher:
            "Code of Virginia (Virginia General Assembly, Legislative Information System)",
          quote:
            "a statement of change on a form prescribed and furnished by the Commission.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The initial registered agent is named in the Articles of Organization (LLC, Form LLC1011) or Articles of Incorporation (stock corporation, Form SCC619) filed to form the entity.",
      sources: [
        {
          url: "https://law.lis.virginia.gov/vacode/title13.1/chapter12/section13.1-1011/",
          publisher:
            "Code of Virginia (Virginia General Assembly, Legislative Information System)",
          quote: "the name of its initial registered agent at that office.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://law.lis.virginia.gov/vacode/title13.1/chapter9/section13.1-619/",
          publisher:
            "Code of Virginia (Virginia General Assembly, Legislative Information System)",
          quote: "the name of its initial registered agent at that office.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
      },
      sources: [
        {
          url: "https://scc.virginia.gov/pages/Virginia-Limited-Liability-Companies",
          publisher: "Virginia State Corporation Commission, Clerk's Office",
          quote: "Form a new Virginia LLC (LLC1011) | $100",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://scc.virginia.gov/pages/New-Virginia-Entity-Fees",
          publisher: "Virginia State Corporation Commission, Clerk's Office",
          quote:
            "Stock Corporation | File Online or complete Articles of Incorporation (Form SCC 619) | See Corporation Charter Fee Schedule | $25",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://law.lis.virginia.gov/vacode/title13.1/chapter9/section13.1-615.1/",
          publisher:
            "Code of Virginia (Virginia General Assembly, Legislative Information System)",
          quote: "$50 for each 25,000 shares or fraction thereof;",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://law.lis.virginia.gov/vacode/title13.1/chapter9/section13.1-616/",
          publisher:
            "Code of Virginia (Virginia General Assembly, Legislative Information System)",
          quote: "Articles of incorporation or domestication",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/virginia/",
      publisher: "Registered Agents Inc.",
      quote:
        "Virginia Registered Agent ... Maintaining your business in Virginia is simple when you hire Registered Agents Inc.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Changing the registered agent or registered office is free in Virginia for both LLCs and stock corporations; it can be filed online through the SCC Clerk's Information System.",
      "Corporation formation cost is a $25 filing fee plus a charter fee of $50 per 25,000 authorized shares (up to 1,000,000 shares; flat $2,500 above that). corpFeeCents 7500 assumes 25,000 or fewer authorized shares.",
      "Under Va. Code 13.1-635, the new registered agent may itself sign and submit the statement of change.",
      "The SCC www.scc.virginia.gov forms pages and PDFs blocked automated fetching (robots); the scc.virginia.gov/pages versions were used.",
    ],
    unverified: [
      "change.consentRequired: the SCC pages and Va. Code 13.1-635 do not state an express consent requirement for the new agent, and the form SCC635/LLC1016 could not be loaded to check for a consent signature line.",
      "Corporation charter fee rises with authorized shares.",
    ],
    stateBlockers: [],
  },
  VT: {
    change: {
      formName: "Statement of Change",
      governmentFeeCents: {
        llc: 3500,
        corporation: 2500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://sos.vermont.gov/business-services/fees-statutes",
          publisher: "Vermont Secretary of State, Business Services Division",
          quote:
            "Statement of Change | 11 V.S.A. § 4008 | $35.00 | 11 V.S.A. § 4012",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.vermont.gov/business-services/fees-statutes",
          publisher: "Vermont Secretary of State, Business Services Division",
          quote:
            "Statement of Change | 11A V.S.A. § 5.02 | $25.00 | 11A V.S.A. § 1.22",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legislature.vermont.gov/statutes/section/11/025/04008",
          publisher: "Vermont General Assembly (Vermont Statutes Online)",
          quote:
            "by delivering to the Secretary for filing a statement of change pursuant to section 1655 of this title.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legislature.vermont.gov/statutes/section/11/015/01655",
          publisher: "Vermont General Assembly (Vermont Statutes Online)",
          quote:
            "(b) Attestation. A person who designates an agent for service of process attests that the agent consents to the appointment.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legislature.vermont.gov/statutes/section/11/025/04012",
          publisher:
            "Vermont General Assembly (Vermont Statutes Online), 11 V.S.A. § 4012 (LLC fees)",
          quote:
            "$35.00 and not to exceed $1,000.00 per filer per calendar year",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legislature.vermont.gov/statutes/section/11/025/04008",
          publisher:
            "Vermont General Assembly (Vermont Statutes Online), 11 V.S.A. § 4008",
          quote:
            "§ 4008. Change of designated office or agent for service of process",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legislature.vermont.gov/statutes/section/11/015/01625",
          publisher:
            "Vermont General Assembly (Vermont Statutes Online), 11 V.S.A. § 1625",
          quote:
            "Statement of change of designated agent or designated office, or both, for a person registered under this subchapter: $25.00, not to exceed $1,000.00 per filer per calendar year.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent (agent for service of process) is named in the Articles of Organization (LLC) or Articles of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://legislature.vermont.gov/statutes/section/11/025/04023",
          publisher: "Vermont General Assembly (Vermont Statutes Online)",
          quote:
            "the name and street address of the initial agent for service of process;",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://legislature.vermont.gov/statutes/section/11a/002/00002.02",
          publisher: "Vermont General Assembly (Vermont Statutes Online)",
          quote:
            "the name and email of its initial registered agent for service of process at that office",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 15500,
        corporation: 15500,
      },
      sources: [
        {
          url: "https://sos.vermont.gov/business-services/fees-statutes",
          publisher: "Vermont Secretary of State, Business Services Division",
          quote:
            "Articles of Organization | 11 V.S.A. § 4023 | $155.00 | 11 V.S.A. § 4012",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.vermont.gov/business-services/fees-statutes",
          publisher: "Vermont Secretary of State, Business Services Division",
          quote:
            "Articles of Incorporation | 11A V.S.A. § 2.02 | $155.00 | 11A V.S.A. § 1.22",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.vermont.gov/business-services/business-filings/domestic-formation/llc",
          publisher: "Vermont Secretary of State, Business Services Division",
          quote: "There is no extra fee for online filing.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/vermont/",
      publisher: "Registered Agents Inc.",
      quote: "Hiring Registered Agents Inc as your Vermont registered agent",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Vermont has no separate change of agent form; the agent is changed by filing a Statement of Change (typically online through the Secretary of State business portal).",
      "Consent is by attestation: under 11 V.S.A. § 1655(b) the person designating the agent attests that the agent consents; no separate signed consent document was found.",
      "The SOS fee table lists $35.00 for an LLC Statement of Change and $25.00 for a business corporation Statement of Change. 11 V.S.A. § 1625(c) separately lists $25.00 for a statement of change of designated agent for persons registered under that subchapter; the SOS fee table was used for the LLC fee.",
      "Vermont fees were revised in 2025; the SOS fee table showed $155.00 for both LLC and corporation formation on 2026-10-29.",
      "Conflict resolved: the LLC change of agent fee is $35. 11 V.S.A. § 1625 applies only to persons registered under Title 11, chapter 15, subchapter 1 (assumed business names, partnerships and similar registrants), so its $25 statement of change fee does not apply to LLCs. LLC fees are set by 11 V.S.A. § 4012, whose item (a)(9) for a change of designated agent or office is $35.00 (capped at $1,000 per filer per calendar year), and the SOS fee table lists the LLC Statement of Change at $35.00 citing § 4012.",
      "The business corporation Statement of Change is $25.00 per the SOS fee table (11A V.S.A. § 1.22); the 11A § 1.22 statute page loaded without its text, so the corporation fee rests on the SOS fee table alone.",
      "11 V.S.A. § 4012 history shows its latest amendment as 2023, No. 77, § 37, eff. June 20, 2023; § 1625 was last amended 2025, No. 10, § 4, eff. July 1, 2025. The SOS fee page shows no date.",
    ],
    unverified: [
      "corporation appointment quote: the 11A V.S.A. § 2.02(a)(4) text was read through a summarizing fetch tool that could only quote part of the clause; confirm exact wording on the statute page.",
      "change.corpFeeCents: 11A V.S.A. § 1.22 page loaded without statute text; $25 rests on the SOS fee table",
    ],
    stateBlockers: [],
  },
  WA: {
    change: {
      formName: "Statement of Change/ Designation of Registered Agent",
      governmentFeeCents: {
        llc: 0,
        corporation: 0,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://www.sos.wa.gov/sites/default/files/2022-09/12.10.2020---statement-of-change-designation-of-registered-agent.pdf",
          publisher:
            "Washington Secretary of State, Corporations and Charities Division",
          quote: "STATEMENT OF CHANGE/ DESIGNATION OF REGISTERED AGENT",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.wa.gov/sites/default/files/2022-09/12.10.2020---statement-of-change-designation-of-registered-agent.pdf",
          publisher:
            "Washington Secretary of State, Corporations and Charities Division",
          quote:
            "There is no filing fee to update or change the Registered Agent.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.wa.gov/sites/default/files/2022-09/12.10.2020---statement-of-change-designation-of-registered-agent.pdf",
          publisher:
            "Washington Secretary of State, Corporations and Charities Division",
          quote:
            "The Consent of the Registered Agent must be signed, regardless of the type of Registered Agent.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.wa.gov/corporations-charities/frequently-asked-questions-faqs/fee-schedules-priority-services",
          publisher:
            "Washington Secretary of State, Corporations and Charities Division",
          quote: "Change of Registered Agent / Office | No Fee",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named, with the agent's consent, in the Certificate of Formation (LLC) or Articles of Incorporation (corporation) filed to form the entity.",
      sources: [
        {
          url: "https://app.leg.wa.gov/RCW/default.aspx?cite=25.15.071",
          publisher:
            "Washington State Legislature (Revised Code of Washington)",
          quote:
            "The name and address of the registered agent for service of process.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://app.leg.wa.gov/RCW/default.aspx?cite=23B.02.020",
          publisher:
            "Washington State Legislature (Revised Code of Washington)",
          quote:
            "The name and address of the corporation's initial registered agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.wa.gov/corporations-charities/business-entities/online-filing-instructions/start-domestic-wa-limited-liability-company-llc-online",
          publisher:
            "Washington Secretary of State, Corporations and Charities Division",
          quote:
            "All businesses must designate a Registered Agent in Washington State",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 18000,
        corporation: 18000,
      },
      sources: [
        {
          url: "https://www.sos.wa.gov/corporations-charities/frequently-asked-questions-faqs/fee-schedules-priority-services",
          publisher:
            "Washington Secretary of State, Corporations and Charities Division",
          quote: "Original Filings | $180",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://www.sos.wa.gov/corporations-charities/business-entities/online-filing-instructions/start-domestic-wa-limited-liability-company-llc-online",
          publisher:
            "Washington Secretary of State, Corporations and Charities Division",
          quote: "$180 in addition to an online processing fee.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/washington/",
      publisher: "Registered Agents Inc.",
      quote:
        "Hire us as your Washington registered agent and we’ll file your annual report for free-you just pay the state fee.",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Online filings add an online processing fee on top of the $180 filing fee; the SOS page does not state the processing fee amount.",
      "The new registered agent must sign the consent section of the Statement of Change; online filers affirm the agent's consent by selecting a consent option.",
      "The fee schedule lists the same values (Original Filings $180; Change of Registered Agent / Office No Fee) in both the LLC and Profit Corporation tables.",
      "Expedited service is optional at $100 per entity; same day is $150.",
    ],
    unverified: [
      "formation: online processing fee amount not stated on the official page.",
    ],
    stateBlockers: [],
  },
  WI: {
    change: {
      formName:
        "Form 13 Statement of Change (Statement of Change of Registered Agent/Office)",
      governmentFeeCents: {
        llc: 1000,
        corporation: 1000,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/Fees.aspx",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote: "Statement of Change Online Filing | $10.00 | $10.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/Fees.aspx",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote:
            "Statement of Change of Registered Agent/Office | $25.00 | $25.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Documents/BusinessServices/BusinessEntities/Forms/CORP13.pdf",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote: "FORM 13 STATEMENT OF CHANGE",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Documents/BusinessServices/BusinessEntities/Forms/CORP13.pdf",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote:
            "Entities must obtain the consent of registered agents before naming them to serve in that capacity.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The initial registered agent is named in the Articles of Organization (LLC, Form 502) or Articles of Incorporation (business corporation, Form 2) filed to form the entity.",
      sources: [
        {
          url: "https://dfi.wi.gov/Documents/BusinessServices/BusinessEntities/Forms/CORP502.pdf",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote: "Name of the initial registered agent:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Documents/BusinessServices/BusinessEntities/Forms/CORP502.pdf",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote:
            "The entity must have a registered agent located at a registered office in Wisconsin.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Documents/BusinessServices/BusinessEntities/Forms/CORP2.pdf",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote: "Name of the initial registered agent:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 13000,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/Fees.aspx",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote:
            "Incorporation/Organization via Online Filing | $100.00 | $130.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/Fees.aspx",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote: "Incorporation/Organization | $100.00 | $170.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Documents/BusinessServices/BusinessEntities/Forms/CORP502.pdf",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote: "FILING FEE $170.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://dfi.wi.gov/Documents/BusinessServices/BusinessEntities/Forms/CORP2.pdf",
          publisher:
            "Wisconsin Department of Financial Institutions, Division of Corporate and Consumer Services",
          quote: "FILING FEE $100.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/wisconsin/",
      publisher: "Registered Agents Inc.",
      quote:
        "Wisconsin Registered Agent ... Registered Agents Inc provides peace of mind with top-shelf registered agent and other business services",
      checkedAt: "2026-10-29",
    },
    notes: [
      "Fees are online fees, which differ from paper: Statement of Change is $10.00 online vs $25.00 paper (LLC and corporation); LLC formation is $130.00 online vs $170.00 paper; corporation formation is $100.00 both ways.",
      "Fee table quotes list the Business Corporation column first and the Limited Liability Company column second.",
      "Consent: Form 13 says the filer affirms that any newly designated registered agent has consented to serve; no separate consent document is filed.",
      "Optional expedited service is an extra $100.00.",
    ],
    unverified: [
      "appointment: Wisconsin statutes site (docs.legis.wisconsin.gov) blocked automated fetching; appointment is sourced from the DFI forms instead.",
    ],
    stateBlockers: [],
  },
  WV: {
    change: {
      formName:
        "Form AAO, Application to Appoint or Change Process, Officers, and/or Addresses",
      governmentFeeCents: {
        llc: 1500,
        corporation: 1500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://sos.wv.gov/sites/default/files/2026-04/AAo%202022.pdf",
          publisher:
            "West Virginia Secretary of State, Business and Licensing Division",
          quote:
            "APPLICATION TO APPOINT OR CHANGE PROCESS, OFFICERS, AND/OR ADDRESSES",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/sites/default/files/2026-04/AAo%202022.pdf",
          publisher:
            "West Virginia Secretary of State, Business and Licensing Division",
          quote: "FEE: $15.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/sites/default/files/2026-04/AAo%202022.pdf",
          publisher:
            "West Virginia Secretary of State, Business and Licensing Division",
          quote:
            "The agent named here has given consent to appointment as agent to accept service of process on behalf of this company.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/media/335/download?inline=",
          publisher: "West Virginia Secretary of State",
          quote:
            "Change of Agent, Address & Officers (AAO) $15.00 All applicable business types",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/agent-address-andor-officer-change",
          publisher: "West Virginia Secretary of State",
          quote: "Filing: $15.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The agent of process, if the entity names one, is named in the Articles of Organization (Form LLD-1) or Articles of Incorporation (Form CD-1) filed to form the entity.",
      sources: [
        {
          url: "https://sos.wv.gov/sites/default/files/2026-07/lld-1_0.pdf",
          publisher:
            "West Virginia Secretary of State, Business and Licensing Division",
          quote:
            "The name and address of the person or company (agent) to whom notice of process may be sent, if any, will be:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/sites/default/files/2026-04/cd-1.pdf",
          publisher:
            "West Virginia Secretary of State, Business and Licensing Division",
          quote:
            "The name and address of the person (agent) to whom notice of process may be sent, if any, will be:",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://sos.wv.gov/sites/default/files/2026-07/lld-1_0.pdf",
          publisher:
            "West Virginia Secretary of State, Business and Licensing Division",
          quote: "FILING FEE: $100",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/sites/default/files/2026-04/cd-1.pdf",
          publisher:
            "West Virginia Secretary of State, Business and Licensing Division",
          quote:
            "FILING FEE: $100 (profit) *Effective July 7, 2017 per WV Code §59-1-2.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/media/335/download?inline=",
          publisher: "West Virginia Secretary of State",
          quote: "Domestic Limited Liability Company $100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wv.gov/media/335/download?inline=",
          publisher: "West Virginia Secretary of State",
          quote: "Domestic For-Profit Corporation $100.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/west-virginia/",
      publisher: "Registered Agents Inc.",
      quote:
        "Our West Virginia Registered Agent Service includes our Renewal Service.",
      checkedAt: "2026-10-29",
    },
    notes: [
      'West Virginia\'s formation forms (LLD-1 and CD-1) ask for an agent of process "if any", so naming an agent at formation appears optional on the forms.',
      "Form AAO includes a New Agent Signature line and states the agent has consented to appointment.",
      "Agent changes can also be filed online through the WV One Stop Business Portal (onestop.wv.gov) for the same $15.00 fee; no online fee difference was listed.",
      "The general fee schedule PDF is dated effective November 18, 2019; current formation forms (Rev. 07/2026 and 11/2025) confirm the $100 formation fees.",
    ],
    unverified: [
      "change.formName: the Form AAO PDF on the SOS site shows Rev. 11/2017; confirm no newer revision before relying on it.",
    ],
    stateBlockers: [],
  },
  WY: {
    change: {
      formName:
        "Appointment of New Registered Agent and Office (with Consent to Appointment by Registered Agent)",
      governmentFeeCents: {
        llc: 500,
        corporation: 500,
      },
      newAgentConsentRequired: true,
      sources: [
        {
          url: "https://sos.wyo.gov/Forms/RA/RA-ROChangeByEntity.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote:
            "$5.00 Filing Fee Make check or money order payable to Wyoming Secretary of State.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wyo.gov/Forms/RA/RA-ROChangeByEntity.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote: "Consent to Appointment by Registered Agent",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wyo.gov/Forms/RA/RA-ROChangeByEntity.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote:
            "This form is used ONLY to change the registered agent from one person/company to a different person/company.",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wyo.gov/business/docs/businessfees.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote:
            "Appointment of New Registered Agent and Office ................................$5.00",
          checkedAt: "2026-10-29",
        },
      ],
    },
    appointment: {
      text: "The registered agent is named in the Articles of Organization (LLC) or Articles of Incorporation (profit corporation), filed together with the agent's signed Consent to Appointment by Registered Agent.",
      sources: [
        {
          url: "https://sos.wyo.gov/forms/business/llc/llc-articlesorganization.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote: "Name and physical address of its registered agent:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wyo.gov/Forms/Business/PROF/P-ArticlesIncorporation.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote: "3. Name and physical address of its registered agent:",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wyo.gov/Business/docs/HowToCreateAWyomingCompany.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote:
            "All business entities filed in Wyoming need a registered agent to accept service of process.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    formation: {
      governmentFeeCents: {
        llc: 10000,
        corporation: 10000,
      },
      sources: [
        {
          url: "https://sos.wyo.gov/business/docs/businessfees.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote:
            "Articles of Organization*/Continuance/Domestication .......................................$100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wyo.gov/business/docs/businessfees.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote:
            "Articles of Incorporation*/Continuance/Domestication.......................................$100.00",
          checkedAt: "2026-10-29",
        },
        {
          url: "https://sos.wyo.gov/forms/business/llc/llc-articlesorganization.pdf",
          publisher: "Wyoming Secretary of State, Business Division",
          quote: "Filing fee of $100.00.",
          checkedAt: "2026-10-29",
        },
      ],
    },
    provider: {
      url: "https://www.registeredagentsinc.com/wyoming/",
      publisher: "Registered Agents Inc.",
      quote:
        "When you hire Registered Agents Inc as your Wyoming registered agent,",
      checkedAt: "2026-10-29",
    },
    notes: [
      "The agent change form is paper only per the fee schedule (not marked as electronically fileable) and the form says it cannot be accepted via email.",
      "The new agent must sign the Consent to Appointment by Registered Agent included with the change form.",
      "Online formation is available for LLCs and profit corporations; a card convenience fee is added online (amount not stated on the page checked).",
      "Fee schedule is Revised June 2026, effective July 1, 2026.",
    ],
    unverified: [
      "formation: online convenience fee amount not stated on the official pages checked.",
    ],
    stateBlockers: [],
  },
};
