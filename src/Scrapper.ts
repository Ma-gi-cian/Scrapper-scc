import puppeteer, { Browser, Page } from "puppeteer";
import SeekScrapper from "./scrappers/Seek.js";
import ProspelScrapper from "./scrappers/Prospel.js";
import Database from "./Database.js";
import GoogleSheetsExporter from "./GoogleSheetsExporter.js";

class Scrapper {
  private browser: Browser | null = null;
  private seekPage: Page | null = null;
  private prospelPage: Page | null = null;
  private Database!: Database 

  constructor() {
  }

  async init_browser(): Promise<void> {
    this.Database = new Database();
    await this.Database.InitDB()
    this.browser = await puppeteer.launch({
      headless: false, // you need to make this true - in production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
  }

async initPages(): Promise<void>{
    if (!this.browser){
      throw new Error('Browser not initialized')
    }

    this.seekPage = await this.browser.newPage();
    this.prospelPage = await this.browser.newPage();
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  async init_scrapers() {

    // THE EXECUTION WILL OCCUR IN EXECUTION BLOCKS - SCRAPE EVERYTHING AND END THE RESOURCE 
    
    // Seek execution block
    if (!this.seekPage) {
    throw new Error('Seek page not initialized. Call initializeSeekPage() first.');
    }
    const seek = new SeekScrapper(this.seekPage, 'https://www.seek.com.au/software-engineer-jobs/remote');
    const seekData = await seek.run(); // the run function executes .close after returning everything
    const seekResults = await this.Database.bulkAddJobs(
      seekData.map(listing => ({listing, source: 'seek' as const})) 
    ) 
    console.log("Prospel Data added:",seekResults.added)

    // Prosple execution block
    if(!this.prospelPage || !this.Database){
      throw new Error('Prospel page not initialized or Database not initialized')
    }
    const prospel = new ProspelScrapper(
      this.prospelPage, 
      'https://au.prosple.com/software-engineering-graduate-jobs-programs-australia'
    );
    const prospelData = await prospel.run();
    const prospelResults = await this.Database.bulkAddJobs(
      prospelData.map(listing => ({ listing, source: 'prosple' as const }))
    );

 // console.log('Results added', results.added)

  }
 
// Add method to view export history
async viewExportHistory(): Promise<void> {
  if (!this.Database) {
    throw new Error('Database not initialized');
  }

  const exports = await this.Database.getAllExports();
  
  console.log(`\nExport History (${exports.length} total exports)\n`);
  
  exports.forEach((exp, index) => {
    console.log(`${index + 1}. ${new Date(exp.exportDate).toLocaleString()}`);
    console.log(`Jobs: ${exp.jobCount}`);
    console.log(`Link: ${exp.spreadsheetUrl}`);
    console.log(`Spreadsheet ID: ${exp.spreadsheetId}\n`);
  });
}

async exportToGoogleSheets(): Promise<string> {
  if (!this.Database) {
    throw new Error('Database not initialized');
  }

  console.log('\nExporting to Google Sheets...');
  
  const unpushedJobs = await this.Database.getUnpushedJobs();
  console.log(`Found ${unpushedJobs.length} unpushed jobs`);

  if (unpushedJobs.length === 0) {
    console.log('No new jobs to export');
    return '';
  }

  const exporter = new GoogleSheetsExporter();
  await exporter.initialize(); // Initialize OAuth2
  
  const spreadsheetId = await exporter.createSpreadsheet(
    unpushedJobs,
    `Job Listings - ${new Date().toISOString().split('T')[0]}`
  );

  const jobHashes = unpushedJobs.map(job => job.hash);
  await this.Database.addExportRecord(spreadsheetId, jobHashes);
  await this.Database.bulkMarkAsPushed(jobHashes);
  
  return spreadsheetId;
}

  
}

export default Scrapper
