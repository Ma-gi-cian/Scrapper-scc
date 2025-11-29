import { google } from 'googleapis';
import { JobDocument } from './Database.js';
import { SeekJobListing, ProspleJobListing } from './types/types.js';
import { authenticate } from '@google-cloud/local-auth';
import path from 'path';
import fs from 'fs';

class GoogleSheetsExporter {
  private sheets: any;
  private auth: any;

  async initialize() {
    const SCOPES = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ];

    const TOKEN_PATH = path.join(process.cwd(), 'token.json');
    const CREDENTIALS_PATH = path.join(process.cwd(), 'oauth-credentials.json');

    // Load credentials from file
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));

    // Check if we have a saved token
    if (fs.existsSync(TOKEN_PATH)) {
      console.log('📋 Loading saved token...');
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      
      const oauth2Client = new google.auth.OAuth2(
        credentials.installed.client_id,
        credentials.installed.client_secret,
        credentials.installed.redirect_uris[0]
      );
      
      oauth2Client.setCredentials(token);
      this.auth = oauth2Client;
    } else {
      console.log('🔐 No token found, starting authentication...');
      // Authenticate and save token
      this.auth = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
      });

      // Save the full credentials for future use
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(this.auth.credentials));
      console.log('✅ Token saved to token.json');
    }

    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Helper to extract location from either Seek or Prosple job
   */
  private getLocation(job: JobDocument): string {
    const data = job.data;
    if (data.source === 'seek') {
      const seekData = data as SeekJobListing & { source: 'seek' };
      return Array.isArray(seekData.locations) 
        ? seekData.locations.join(', ') 
        : seekData.locations;
    } else {
      const prospleData = data as ProspleJobListing & { source: 'prosple' };
      return Array.isArray(prospleData.location) 
        ? prospleData.location.join(', ') 
        : prospleData.location;
    }
  }

  /**
   * Helper to get start/listing date
   */
  private getDate(job: JobDocument): string {
    const data = job.data;
    if (data.source === 'prosple') {
      const prospleData = data as ProspleJobListing & { source: 'prosple' };
      return prospleData.startDate ? new Date(prospleData.startDate).toLocaleDateString() : '';
    } else {
      const seekData = data as SeekJobListing & { source: 'seek' };
      return seekData.listingDate || '';
    }
  }

  /**
   * Helper to get description (short version only)
   */
  private getDescription(job: JobDocument): string {
    const data = job.data;
    if (data.source === 'seek') {
      const seekData = data as SeekJobListing & { source: 'seek' };
      return seekData.description || '';
    } else {
      const prospleData = data as ProspleJobListing & { source: 'prosple' };
      const fullDesc = prospleData.fullDescription || '';
      const firstParagraph = fullDesc.split('\n')[0];
      return firstParagraph.length > 200 
        ? firstParagraph.substring(0, 200) + '...' 
        : firstParagraph;
    }
  }

  async createSpreadsheet(jobs: JobDocument[], title?: string): Promise<string> {
    const sheetTitle = title || `Job Listings - ${new Date().toLocaleDateString()}`;
    
    try {
      const createResponse = await this.sheets.spreadsheets.create({
        requestBody: {
          properties: { title: sheetTitle },
          sheets: [{
            properties: {
              title: 'Jobs',
              gridProperties: { frozenRowCount: 1 }
            }
          }]
        }
      });

      const spreadsheetId = createResponse.data.spreadsheetId!;
      console.log(`✅ Created spreadsheet: ${sheetTitle}`);
      console.log(`🔗 Link: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);

      await this.addJobsToSpreadsheet(spreadsheetId, jobs);

      return spreadsheetId;
    } catch (error) {
      console.error('Error creating spreadsheet:', error);
      throw error;
    }
  }

  private async addJobsToSpreadsheet(spreadsheetId: string, jobs: JobDocument[]) {
    const validJobs = jobs.filter(job => job.data);

    const headers = [
      'Title', 'Company', 'Location', 'Salary', 'Start Date',
      'URL', 'Description', 'Source', 'Added Date', 'Pushed'
    ];

    const rows = validJobs.map(job => [
      job.data.title || '',
      job.data.company || '',
      this.getLocation(job),
      job.data.salary || '',
      this.getDate(job),
      job.data.url || '',
      this.getDescription(job),
      job.data.source,
      job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '',
      job.data.pushed ? 'Yes' : 'No'
    ]);

    const values = [headers, ...rows];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Jobs!A1',
      valueInputOption: 'RAW',
      requestBody: { values }
    });

    console.log(`✅ Added ${validJobs.length} jobs to spreadsheet`);
  }
  
  async appendJobs(spreadsheetId: string, jobs: JobDocument[]) {
    const validJobs = jobs.filter(job => job.data);

    const rows = validJobs.map(job => [
      job.data.title || '', job.data.company || '', this.getLocation(job),
      job.data.salary || '', this.getDate(job), job.data.url || '',
      this.getDescription(job), job.data.source,
      job.createdAt ? new Date(job.createdAt).toLocaleDateString() : '',
      job.data.pushed ? 'Yes' : 'No'
    ]);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Jobs!A2',
      valueInputOption: 'RAW',
      requestBody: { values: rows }
    });

    console.log(`✅ Appended ${validJobs.length} new jobs`);
  }
}

export default GoogleSheetsExporter;
