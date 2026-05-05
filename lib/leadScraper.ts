// ADDITIVE: Grid search locations and mapping
export const OTTAWA_SUB_REGIONS = [
  "Kanata, ON", "Nepean, ON", "Barrhaven, ON", 
  "Orleans, ON", "Gloucester, ON", "Gatineau, QC", 
  "Stittsville, ON", "Richmond, ON"
];

const INDUSTRY_TYPE_MAP = {
  "construction": ["general_contractor", "roofing_contractor", "plumber", "electrician", "hvac", "painter"],
  "auto": ["car_repair", "car_dealer", "auto_parts_store"],
  "hospitality": ["restaurant", "cafe", "bar"]
};

export function getTypesForIndustry(industryKeyword: string) {
  const normalizedKey = industryKeyword.toLowerCase().trim();
  return INDUSTRY_TYPE_MAP[normalizedKey] || [normalizedKey]; 
}

// ADDITIVE: Deep fetching with pagination
export async function fetchDeepLeads(industry: any, location: string | number | boolean) {
  let allLeads: any[] = [];
  let nextPageToken = null;
  const targetTypes = getTypesForIndustry(industry);
  let primaryType = targetTypes[0]; 

  do {
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(location)}&type=${primaryType}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
    
    if (nextPageToken) {
      url += `&pagetoken=${nextPageToken}`;
      await new Promise(resolve => setTimeout(resolve, 2000)); 
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.results) {
      allLeads = allLeads.concat(data.results);
    }
    nextPageToken = data.next_page_token || null;

  } while (nextPageToken && allLeads.length < 100); 

  return allLeads;
}