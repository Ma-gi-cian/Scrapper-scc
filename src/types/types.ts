export interface SeekJobListing {
  jobId: string | null;
  title: string;
  company: string;
  locations: string | string[];
  workArrangement?: string;
  salary?: string;
  description: string;           // Short description from card
  fullDescription: string;       // Full description from detail panel
  listingDate?: string;
  url: string;
  isPremium: boolean;
  classification?: string;
  subClassification?: string;
  hash:string;
  pushed: boolean
}

export interface ProspleJobListing {
  title: string;
  company: string;
  location: string | string[];
  salary?: string;
  startDate: Date | string;
  url?: string;
  badges?: string[];          
  timingInfo?: string;        
  fullDescription?: string;   
  dataNode?: string;
  hash: string; // Hash - should be there for all the types
  pushed: boolean ; // This is for checking if it has been pushed to the google sheet - make it true after being pushed          
}