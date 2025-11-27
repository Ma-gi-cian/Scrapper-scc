export interface SeekJobListing {
  jobId: string | null;
  title?: string;
  company?: string;
  locations: string[];
  workArrangement?: string;
  salary?: string;
  description?: string;           // Short description from card
  fullDescription?: string;       // Full description from detail panel
  listingDate?: string;
  url?: string;
  isPremium: boolean;
  classification?: string;
  subClassification?: string;
}

export interface ProspleJobListing {
  title?: string;
  company?: string;
  location?: string;
  salary?: string;
  startDate?: string;
  url?: string;
  badges?: string[];          
  timingInfo?: string;        
  fullDescription?: string;   
  dataNode?: string;          
}