export interface StateLicenseLookup {
  state: string;
  url: string;
}

export const stateLicenseLookups: StateLicenseLookup[] = [
  { state: "Alabama", url: "https://arec.alabama.gov/apps/licensee-search" },
  { state: "Alaska", url: "https://www.commerce.alaska.gov/cbp/main/Search/Professional" },
  { state: "Arizona", url: "https://services.azre.gov/PdbWeb/IndividualLicense/SearchIndividualLicenses" },
  { state: "Arkansas", url: "https://www.arec.arkansas.gov/licensee-search/" },
  { state: "California", url: "https://www.dre.ca.gov/licensees/" },
  { state: "Colorado", url: "https://apps.colorado.gov/dora/licensing/lookup/" },
  { state: "Connecticut", url: "https://www.elicense.ct.gov/" },
  { state: "Delaware", url: "https://delpros.delaware.gov/" },
  { state: "Florida", url: "https://www.myfloridalicense.com/wl11.asp?mode=0" },
  { state: "Georgia", url: "https://www.grec.state.ga.us/" },
  { state: "Hawaii", url: "https://pvl.ehawaii.gov/pvlsearch/app" },
  { state: "Idaho", url: "https://irec.idaho.gov/" },
  { state: "Illinois", url: "https://online-dfpr.micropact.com/" },
  { state: "Indiana", url: "https://www.in.gov/pla/license.htm" },
  { state: "Iowa", url: "https://plb.iowa.gov/" },
  { state: "Kansas", url: "https://krec.ks.gov/" },
  { state: "Kentucky", url: "https://krec.ky.gov/" },
  { state: "Louisiana", url: "https://lrec.gov/" },
  { state: "Maine", url: "https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/SearchIndividual.aspx" },
  { state: "Maryland", url: "https://www.dllr.state.md.us/license/" },
  { state: "Massachusetts", url: "https://elicensing.mass.gov/" },
  { state: "Michigan", url: "https://www.lara.michigan.gov/" },
  { state: "Minnesota", url: "https://mn.gov/boards/" },
  { state: "Mississippi", url: "https://www.mrec.ms.gov/" },
  { state: "Missouri", url: "https://pr.mo.gov/" },
  { state: "Montana", url: "https://ebiz.mt.gov/pol/" },
  { state: "Nebraska", url: "https://nrec.nebraska.gov/" },
  { state: "Nevada", url: "https://red.nv.gov/" },
  { state: "New Hampshire", url: "https://www.oplc.nh.gov/" },
  { state: "New Jersey", url: "https://www.njconsumeraffairs.gov/" },
  { state: "New Mexico", url: "https://www.rld.nm.gov/" },
  { state: "New York", url: "https://www.dos.ny.gov/licensing/" },
  { state: "North Carolina", url: "https://www.ncrec.gov/" },
  { state: "North Dakota", url: "https://www.realestatend.org/" },
  { state: "Ohio", url: "https://elicense.ohio.gov/" },
  { state: "Oklahoma", url: "https://www.ok.gov/OREC/" },
  { state: "Oregon", url: "https://www.oregon.gov/rea/" },
  { state: "Pennsylvania", url: "https://www.pals.pa.gov/" },
  { state: "Rhode Island", url: "https://elicensing.ri.gov/" },
  { state: "South Carolina", url: "https://llr.sc.gov/re/" },
  { state: "South Dakota", url: "https://dlr.sd.gov/" },
  { state: "Tennessee", url: "https://verify.tn.gov/" },
  { state: "Texas", url: "https://www.trec.texas.gov/" },
  { state: "Utah", url: "https://dopl.utah.gov/" },
  { state: "Vermont", url: "https://sos.vermont.gov/" },
  { state: "Virginia", url: "https://www.dpor.virginia.gov/" },
  { state: "Washington", url: "https://www.dol.wa.gov/" },
  { state: "West Virginia", url: "https://rec.wv.gov/" },
  { state: "Wisconsin", url: "https://licensesearch.wi.gov/" },
  { state: "Wyoming", url: "https://realestate.wyo.gov/" },
  { state: "Washington D.C.", url: "https://govservices.dcra.dc.gov/oplaportal/Home/GetLicenseSearchDetails" },
  { state: "Puerto Rico", url: "https://pr.pcshq.com/lookup/en/" }
];

export function getLicenseLookupUrl(state: string): string | null {
  const lookup = stateLicenseLookups.find(
    (l) => l.state.toLowerCase() === state.toLowerCase()
  );
  return lookup?.url || null;
}

export function getLicenseLookupByStateAbbr(stateAbbr: string): string | null {
  const stateMap: Record<string, string> = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
    'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
    'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
    'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
    'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
    'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
    'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
    'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
    'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
    'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
    'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'Washington D.C.', 'PR': 'Puerto Rico'
  };
  
  const stateName = stateMap[stateAbbr.toUpperCase()];
  return stateName ? getLicenseLookupUrl(stateName) : null;
}
