// utils/hashUtils.ts
import createHash from 'create-hash';
import { SeekJobListing, ProspleJobListing } from "../types/types";

type JobListing = SeekJobListing | ProspleJobListing;

/**
 * Normalize text for consistent hashing
 */
function normalizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .replace(/[^\w\s]/g, '');  // Remove special characters
}

/**
 * Normalize date to consistent format
 */
function normalizeDate(date: string | Date | undefined | null): string {
  if (!date) return '';
  
  // If it's already a Date object
  if (date instanceof Date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  
  // If it's a string, normalize it
  const dateStr = String(date).toLowerCase().trim();
  return dateStr.replace(/\s+/g, '');
}

/**
 * Generate hash based on: title + company + url + date + description
 * Uses create-hash library with SHA-256
 */
export function generateJobHash(job: JobListing): string {
  const title = normalizeText(job.title);
  const company = normalizeText(job.company);
  const url = normalizeText(job.url || '');
  
  // Handle different date fields
  let date = '';
  if ('listingDate' in job) {
    date = normalizeDate(job.listingDate);
  } else if ('startDate' in job) {
    date = normalizeDate(job.startDate);
  }
  
  // Use fullDescription (longer, more unique) or fall back to description
  let description = '';
  if (job.fullDescription) {
    description = normalizeText(job.fullDescription);
  } else if ('description' in job) {
    description = normalizeText(job.description);
  }
  
  // Combine all fields with delimiter
  const uniqueString = `${title}|${company}|${url}|${date}|${description}`;
  
  // Create hash using create-hash (synchronous method)
  const hash = createHash('sha256');
  hash.update(uniqueString);
  return hash.digest('hex');
}

/**
 * Generate hash using SHA-224 (shorter output)
 */
export function generateJobHashSHA224(job: JobListing): string {
  const title = normalizeText(job.title);
  const company = normalizeText(job.company);
  const url = normalizeText(job.url || '');
  
  let date = '';
  if ('listingDate' in job) {
    date = normalizeDate(job.listingDate);
  } else if ('startDate' in job) {
    date = normalizeDate(job.startDate);
  }
  
  let description = '';
  if (job.fullDescription) {
    description = normalizeText(job.fullDescription);
  } else if ('description' in job) {
    description = normalizeText(job.description);
  }
  
  const uniqueString = `${title}|${company}|${url}|${date}|${description}`;
  
  // Create SHA-224 hash (shorter - 56 chars vs 64 chars for SHA-256)
  const hash = createHash('sha224');
  hash.update(uniqueString);
  return hash.digest('hex');
}

/**
 * Generate hash using streaming API (for very large descriptions)
 * Fixed version - properly handles the stream
 */
export function generateJobHashStream(job: JobListing): string {
  const hash = createHash('sha256');
  
  // Write data as a stream
  hash.write(normalizeText(job.title));
  hash.write('|');
  hash.write(normalizeText(job.company));
  hash.write('|');
  hash.write(normalizeText(job.url || ''));
  hash.write('|');
  
  // Handle date
  if ('listingDate' in job) {
    hash.write(normalizeDate(job.listingDate));
  } else if ('startDate' in job) {
    hash.write(normalizeDate(job.startDate));
  }
  hash.write('|');
  
  // Write description
  if (job.fullDescription) {
    hash.write(normalizeText(job.fullDescription));
  } else if ('description' in job) {
    hash.write(normalizeText(job.description));
  }
  
  // End the stream and get digest
  hash.end();
  
  // Use digest() instead of read() for proper hash retrieval
  return hash.digest('hex');
}

/**
 * Generate a shorter hash (first 32 characters)
 */
export function generateShortJobHash(job: JobListing): string {
  return generateJobHash(job).substring(0, 32);
}

/**
 * Verify if a job matches a given hash
 */
export function verifyJobHash(job: JobListing, hash: string): boolean {
  return generateJobHash(job) === hash;
}

/**
 * Remove duplicate jobs from an array based on hash
 */
export function removeDuplicates<T extends JobListing & { hash?: string }>(
  jobs: T[]
): T[] {
  const seen = new Set<string>();
  const unique: T[] = [];
  
  for (const job of jobs) {
    const hash = job.hash || generateJobHash(job);
    if (!seen.has(hash)) {
      seen.add(hash);
      unique.push({ ...job, hash });
    } else {
      console.log(`  ⚠ Duplicate found: ${job.title} (${job.company})`);
    }
  }
  
  console.log(`  Removed ${jobs.length - unique.length} duplicates`);
  return unique;
}

/**
 * Group jobs by hash (find all duplicates)
 */
export function groupByHash<T extends JobListing>(
  jobs: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  for (const job of jobs) {
    const hash = generateJobHash(job);
    const existing = groups.get(hash) || [];
    existing.push(job);
    groups.set(hash, existing);
  }
  
  return groups;
}

/**
 * Find duplicates within a job array
 */
export function findDuplicates<T extends JobListing>(
  jobs: T[]
): { hash: string; jobs: T[] }[] {
  const groups = groupByHash(jobs);
  const duplicates: { hash: string; jobs: T[] }[] = [];
  
  groups.forEach((jobList, hash) => {
    if (jobList.length > 1) {
      duplicates.push({ hash, jobs: jobList });
    }
  });
  
  return duplicates;
}

