import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { SeekJobListing, ProspleJobListing } from './types/types';

// Discriminated union for job listings
type JobListing = 
  | (SeekJobListing & { source: 'seek' })
  | (ProspleJobListing & { source: 'prosple' });

// PouchDB document wrapper
interface JobDocument {
  _id: string;
  _rev?: string;
  hash: string;
  createdAt: string;
  data: JobListing;
}

interface ExportRecord {
  _id: string;
  _rev?: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  exportDate: string;
  jobCount: number;
  jobHashes: string[];
}

class Database {
  private db: PouchDB.Database<JobDocument> | null = null;
  private exportDb: PouchDB.Database<ExportRecord> | null = null;

  constructor() {
    // Don't initialize here - call InitDB() manually
  }

  public async InitDB() {
    PouchDB.plugin(PouchDBFind);
    this.db = new PouchDB<JobDocument>('databases/scrapper-db/');
    this.exportDb = new PouchDB<ExportRecord>('databases/exports-db/');
    
    // create index for hash-based deduplication
    await this.db!.createIndex({
      index: { fields: ['hash'] }
    });
    
    // create index for unpushed jobs
    await this.db!.createIndex({
      index: { fields: ['data.pushed'] }
    });

    await this.exportDb!.createIndex({
      index: { fields: ['exportDate'] }
    });
  }

  // single method to add any job - checks hash and adds only if not present
  public async addJob(
    listing: SeekJobListing | ProspleJobListing,
    source: 'seek' | 'prosple'
  ): Promise<boolean> {
    // check if the hash exists in database
    try {
      const result = await this.db!.find({
        selector: { hash: listing.hash },
        limit: 1
      });
      
      if (result.docs.length > 0) {
        console.log(`Duplicate job detected (hash: ${listing.hash.slice(0, 8)}...), skipping`);
        return false;
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return false;
    }

    // Remove hash from listing to avoid duplication in data
    const { hash, ...listingWithoutHash } = listing;

    // Hash is not present in the database, add the job
    const doc: JobDocument = {
      _id: listing.hash,
      hash: listing.hash,
      createdAt: new Date().toISOString(),
      data: { ...listingWithoutHash, source } as JobListing
    };

    try {
      await this.db!.put(doc);
      console.log(`Added new ${source} job: ${listing.title}`);
      return true;
    } catch (error) {
      // catch conflict errors (409) when hash already exists
      if ((error as any).status === 409) {
        console.log(`Duplicate job detected (hash: ${listing.hash.slice(0, 8)}...), skipping`);
        return false;
      }
      console.error(`Error adding ${source} job:`, error);
      return false;
    }
  }

  // Reset all jobs to unpushed status
  public async resetAllToPushed(pushed: boolean = false): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const allJobs = await this.getAllJobs();
    const validJobs = allJobs.filter(j => j.data);
    
    let updateCount = 0;
    for (const job of validJobs) {
      if (job.data.pushed !== pushed) {
        job.data.pushed = pushed;
        try {
          await this.db.put(job);
          updateCount++;
        } catch (error) {
          console.error(`Error updating job ${job._id}:`, error);
        }
      }
    }
    
    return updateCount;
  }

  // bulk add jobs - pass the entire array
  public async bulkAddJobs(
    jobs: Array<{ listing: SeekJobListing | ProspleJobListing; source: 'seek' | 'prosple' }>
  ): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    
    for (const { listing, source } of jobs) {
      const result = await this.addJob(listing, source);
      result ? added++ : skipped++;
    }
    
    return { added, skipped };
  }

  // get all unpushed jobs
  public async getUnpushedJobs(): Promise<JobDocument[]> {
    const result = await this.db!.find({
      selector: { 'data.pushed': false },
      limit: Number.MAX_SAFE_INTEGER
    });
    return result.docs;
  }

  // Mark job as pushed (by hash)
  public async markAsPushed(hash: string): Promise<boolean> {
    try {
      const doc = await this.db!.get(hash);
      doc.data.pushed = true;
      await this.db!.put(doc);
      return true;
    } catch (error) {
      console.error('Error marking as pushed:', error);
      return false;
    }
  }

  // bulk mark jobs as pushed
  public async bulkMarkAsPushed(hashes: string[]): Promise<number> {
    let markedCount = 0;
    
    for (const hash of hashes) {
      const result = await this.markAsPushed(hash);
      if (result) markedCount++;
    }
    
    return markedCount;
  }

  // get job by hash
  public async getJobByHash(hash: string): Promise<JobDocument | null> {
    try {
      return await this.db!.get(hash);
    } catch (error) {
      return null;
    }
  }

  // get all jobs
  public async getAllJobs(): Promise<JobDocument[]> {
    const result = await this.db!.allDocs({ include_docs: true });
    return result.rows.map(row => row.doc!);
  }

  // Add export record
  public async addExportRecord(
    spreadsheetId: string,
    jobHashes: string[]
  ): Promise<boolean> {
    if (!this.exportDb) {
      throw new Error('Exports database not initialized');
    }

    const exportRecord: ExportRecord = {
      _id: `export_${Date.now()}`,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      exportDate: new Date().toISOString(),
      jobCount: jobHashes.length,
      jobHashes
    };

    try {
      await this.exportDb.put(exportRecord);
      console.log(`✅ Export record saved to database`);
      return true;
    } catch (error) {
      console.error('Error saving export record:', error);
      return false;
    }
  }

  // Get all exports
  public async getAllExports(): Promise<ExportRecord[]> {
    if (!this.exportDb) {
      throw new Error('Exports database not initialized');
    }

    const result = await this.exportDb.allDocs({ include_docs: true });
    return result.rows.map(row => row.doc!);
  }

  // Get recent exports (last N days)
  public async getRecentExports(days: number = 7): Promise<ExportRecord[]> {
    if (!this.exportDb) {
      throw new Error('Exports database not initialized');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.exportDb.find({
      selector: {
        exportDate: { $gte: cutoffDate.toISOString() }
      },
      sort: [{ exportDate: 'desc' }]
    });

    return result.docs;
  }

  // Get export by spreadsheet ID
  public async getExportBySpreadsheetId(spreadsheetId: string): Promise<ExportRecord | null> {
    if (!this.exportDb) {
      throw new Error('Exports database not initialized');
    }

    const result = await this.exportDb.find({
      selector: { spreadsheetId },
      limit: 1
    });

    return result.docs.length > 0 ? result.docs[0] : null;
  }

  // Get latest export
  public async getLatestExport(): Promise<ExportRecord | null> {
    if (!this.exportDb) {
      throw new Error('Exports database not initialized');
    }

    const result = await this.exportDb.find({
      selector: { exportDate: { $exists: true } },
      sort: [{ exportDate: 'desc' }],
      limit: 1
    });

    return result.docs.length > 0 ? result.docs[0] : null;
  }
}

export { JobDocument, ExportRecord };
export default Database;
