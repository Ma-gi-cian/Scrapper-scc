import { Page } from "puppeteer";
import { SeekJobListing } from "../types/types";

// example url -> https://www.seek.com.au/software-engineer-jobs/remote

/**
 * THIS PAGE IS DOCUMENTED - USE THIS AS REFERENCE WHEN CREATING OTHER PAGES FOR OTHER WEBSITES
 */

class SeekScrapper {
  private page: Page
  private url: string
  private totalPages: number = 1 // defaulting to 1
  private jobsPerPage: number = 22 // this is site specific - Seek.com has 22 jobs per page

  constructor(page: Page, url: string) {
    this.page = page
    this.url = url
    this.totalPages = 1
    // this needs to be seen - cannot do async - await in the constructor 
  }

  /**
   * Helper function to wait/delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sets up the viewport to a larger size for better content visibility
   */
  async setupViewport(): Promise<void> {
    await this.page.setViewport({
      width: 1920,   // Full HD width
      height: 1080,  // Full HD height
      deviceScaleFactor: 1,
    });
  }

  async run(){
    await this.setupViewport(); // Set viewport before scraping
    await this.get_loop_number();
    const data = await this.scrape()
    await this.close()
    return data;
  }

  /**
   * Fetches the total number of jobs and calculates the number of pages to loop through.
   * Always run this before the scrape function - this or else only one page will be scraped 
   */
  async get_loop_number(): Promise<void> {
    try {
      await this.page.goto(this.url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })
      await this.page.waitForSelector('[data-automation="totalJobsMessage"]', { timeout: 10000 });
      
      const jobCount = await this.page.$eval(
        '[data-automation="totalJobsMessage"] span',
        (el: Element) => {
          const text = el.textContent?.trim() || '';
          // this is regex to match the number from 133 it will return 133
          const match = text.match(/(\d+)\s+jobs?/i); 
          return match ? parseInt(match[1], 10) : null;
        }
      );

      if (jobCount !== null) {
        this.totalPages = jobCount > this.jobsPerPage ? Math.ceil(jobCount / this.jobsPerPage) : 1;
      } else {
        // could not find the Job Count - need to log error here
        // TODO: Integrate a logging library for this - give this priority : FATAL
        this.totalPages = 1;
      }
    } catch (error) {
      console.error('Error fetching job count or selector timeout:', error);
      // fallback to 1 page on error
      this.totalPages = 1;
    }
  }
  // Need to be specific about the nativation logic in each websites
  /**
   * Clicks on a job card to open the detail panel and extracts full job description
   * @param jobId - The unique job ID to click on
   * @returns Full job description from the detail panel
   */
  async getJobDetailsFromPanel(jobId: string): Promise<Partial<SeekJobListing>> {
    try {
      const cardSelector = `article[data-job-id="${jobId}"]`;
      const cardTitleSelector = `${cardSelector} a[data-automation="jobTitle"]`;
      
      // Scroll the card into view
      await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, cardSelector);

      // Wait for scroll
      await this.delay(300);

      // Click on the job title to open the detail panel
      await this.page.evaluate((selector) => {
        const link = document.querySelector(selector) as HTMLElement;
        if (link) {
          link.click();
        }
      }, cardTitleSelector);
      
      // Wait for the detail panel to load
      await this.delay(1500);
      
      // Now extract ONLY the job description from the detail panel
      const detailPanelData = await this.page.evaluate(() => {
        // Target specific job detail container - not the entire page
        // Look for the main job detail section
        const jobDetailSelectors = [
          '[data-automation="jobAdDetails"]',
          '[data-automation="job-detail-body"]',
          'div[data-automation="jobDetailsSection"]',
          'article[data-automation="job-details"]',
          // Fallback: look for main content area
          'main section',
        ];

        let jobDetailContainer: Element | null = null;
        
        for (const selector of jobDetailSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            jobDetailContainer = element;
            break;
          }
        }

        // If we can't find a specific container, return empty
        if (!jobDetailContainer) {
          return { fullDescription: '' };
        }

        // Extract text from the job detail container ONLY
        const fullDescription = jobDetailContainer.textContent?.trim() || '';

        return {
          fullDescription: fullDescription,
        };
      });
      
      return detailPanelData;
    } catch (error) {
      console.error(`    Error getting details from panel for job ${jobId}:`, error instanceof Error ? error.message : error);
      return {}; // Return empty object on error
    }
  }

  /**
   * Scrapes job listings across all calculated pages.
   * @returns A promise that resolves to an array of all SeekJobListing objects.
   */
  async scrape(): Promise<SeekJobListing[]> { 
    const allJobs: SeekJobListing[] = []; // Use a single array for all results

    for (let i = 1; i <= this.totalPages; i++) {
      console.log(`Scraping page ${i} of ${this.totalPages}...`);
      
      await this.page.goto(this.url + `?page=${i}`, {
        waitUntil: 'networkidle0', // there are two waiting protocols : 'networkidle0' and 'networkidle2'
        timeout: 30000
      });

      // wait for the job cards to be loaded before scraping.
      await this.page.waitForSelector('article[data-testid="job-card"]', { timeout: 10000 });

      // Get all job IDs first
      const jobIds = await this.page.$$eval(
        'article[data-testid="job-card"]',
        (cards: Element[]) => cards.map(card => card.getAttribute('data-job-id')).filter(id => id !== null) as string[]
      );

      console.log(`Found ${jobIds.length} jobs on page ${i}`);

      // scrape all job cards on the current page (basic info)
      const jobs = await this.page.$$eval(
        'article[data-testid="job-card"]', 
        (cards: Element[]): SeekJobListing[] => {
        
          return cards.map(card => {
            const getText = (selector: string): string | undefined => 
              card.querySelector(selector)?.textContent?.trim();

            const isPremium = card.getAttribute('data-automation') === 'premiumJob';
            
            return {
              jobId: card.getAttribute('data-job-id'),
              title: getText('a[data-automation="jobTitle"]'),
              company: getText('[data-automation="jobCompany"]'),
              // Map all location elements
              locations: Array.from(card.querySelectorAll('span[data-automation="jobLocation"]')).map(el => el.textContent?.trim() || ''),
              workArrangement: getText('[data-testid="work-arrangement"]'),
              salary: getText('span[data-automation="jobSalary"]'),
              description: getText('span[data-automation="jobShortDescription"]'),
              listingDate: getText('span[data-automation="jobListingDate"]'),
              // Get href attribute
              url: card.querySelector('a[data-automation="job-list-item-link-overlay"]')?.getAttribute('href'),
              isPremium: isPremium,
              classification: getText('span[data-automation="jobClassification"]'),
              subClassification: getText('span[data-automation="jobSubClassification"]'),
            } as SeekJobListing; // typecasting this shit - kids learn why ? typescript 
          });
      });
      
      // Now click each card to open detail panel and get full description
      for (let j = 0; j < jobs.length; j++) {
        const job = jobs[j];
        if (job.jobId) {
          console.log(`  [${j + 1}/${jobs.length}] Opening: ${job.title || job.jobId}`);
          
          // Get full description from the detail panel
          const panelDetails = await this.getJobDetailsFromPanel(job.jobId);
          
          // Merge panel details into the job object
          jobs[j] = { ...job, ...panelDetails };
          
          // Add a small delay between clicks
          await this.delay(400);
        }
      }
      
      // push the jobs to the total thing to be returned after the scrape function is over and all
      allJobs.push(...jobs);
    }
    
    return allJobs;
  }

  async close(){
    await this.page.close();
  }
}

export default SeekScrapper
