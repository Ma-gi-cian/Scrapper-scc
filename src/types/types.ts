interface SeekJobListing {
  jobId: string | null;
  title: string | undefined;
  company: string | undefined;
  locations: string[];
  workArrangement: string | undefined;
  salary: string | undefined;
  description: string | undefined;
  listingDate: string | undefined;
  url: string | null;
  isPremium: boolean;
  classification: string | undefined;
  subClassification: string | undefined;
}

export { SeekJobListing } 