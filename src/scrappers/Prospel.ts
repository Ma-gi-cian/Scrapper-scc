import { Page } from "puppeteer";
import { ProspleJobListing } from "../types/types";

// example url -> https://au.prosple.com/software-engineering-graduate-jobs-programs-australia

class ProspelScrapper {
  private page: Page
  private url: string
  private totalPages: number = 1
  private jobsPerPage: number = 20

  constructor(page: Page, url: string) {
    this.page = page
    this.url = url
    this.totalPages = 1
  }

  /**
   * Helper function to wait/delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sets up the viewport and user agent
   */
  async setupViewport(): Promise<void> {
    await this.page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  async run() {
    await this.setupViewport();
    await this.get_loop_number();
    const data = await this.scrape()
    await this.close()
    return data;
  }

  /**
   * Fetches the total number of jobs
   */
  async get_loop_number(): Promise<void> {
    try {
      console.log('Loading initial page...');
      
      await this.page.goto(this.url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      
      await this.delay(3000);
      await this.page.waitForSelector('h1', { timeout: 20000 });
      
      const jobCount = await this.page.evaluate(() => {
        const heading = document.querySelector('h1');
        if (heading) {
          const match = heading.textContent?.match(/(\d+)\s+open\s+now/i);
          return match ? parseInt(match[1], 10) : null;
        }
        return null;
      });

      if (jobCount !== null && jobCount > 0) {
        this.totalPages = Math.ceil(jobCount / this.jobsPerPage);
        console.log(`Total jobs: ${jobCount}, Total pages: ${this.totalPages}`);
      } else {
        console.log('Could not find job count, defaulting to 1 page');
        this.totalPages = 1;
      }
    } catch (error) {
      console.error('Error fetching job count:', error);
      this.totalPages = 1;
    }
  }

  /**
   * Clicks a job card and extracts content from the side panel
   */
  async getJobDetailsFromSidePanel(cardIndex: number): Promise<Partial<ProspleJobListing>> {
    try {
      // get all job cards
      const cards = await this.page.$$('section[role="button"]');
      
      if (cardIndex >= cards.length) {
        console.log(`    Card index ${cardIndex} out of bounds`);
        return {};
      }

      const card = cards[cardIndex];

      // scroll card into view
      await card.evaluate((el: Element) => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      await this.delay(500);

      // click the card to open side panel
      await card.click();
      
      //  side panel needs to be loaded fully load
      await this.delay(2500);
      
      // extract description from the side panel
      const panelData = await this.page.evaluate(() => {
        // the llm was not sure which container is the sidepanel - so did this to make it work - it was giving this all could be a container 
        const possiblePanelSelectors = [
          'aside',
          'div[role="dialog"]',
          '[data-testid="job-detail-panel"]',
          'div[class*="side"]',
          'div[class*="panel"]',
          'div[class*="drawer"]',
        ];

        let panelElement: Element | null = null;
        
        for (const selector of possiblePanelSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const rect = element.getBoundingClientRect();
            if (rect.right > window.innerWidth / 2 && rect.width > 300) {
              panelElement = element;
              break;
            }
          }
        }

        if (!panelElement) {
          const allText: string[] = [];
          const allElements = document.querySelectorAll('p, li, div, span');
          
          allElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.left > window.innerWidth / 2 && rect.width > 200) {
              const text = el.textContent?.trim();
              if (text && 
                  text.length > 40 && 
                  !allText.includes(text) &&
                  !text.startsWith('Pre-register') &&
                  !text.startsWith('Save') &&
                  !text.includes('Sort by') &&
                  !text.includes('Filter by')) {
                allText.push(text);
              }
            }
          });
          
          return {
            fullDescription: allText.join('\n\n'),
          };
        }

        // extract text from the panel element
        const paragraphs = panelElement.querySelectorAll('p, li');
        const descriptionParts: string[] = [];
        
        paragraphs.forEach(el => {
          const text = el.textContent?.trim();
          if (text && 
              text.length > 40 && 
              !descriptionParts.includes(text) &&
              !text.startsWith('Pre-register') &&
              !text.startsWith('Save')) {
            descriptionParts.push(text);
          }
        });

        return {
          fullDescription: descriptionParts.join('\n\n') || panelElement.textContent?.trim() || '',
        };
      });

      return panelData;
    } catch (error) {
      console.error(`    Error getting details from side panel:`, error instanceof Error ? error.message : error);
      return { fullDescription: 'Error loading details' };
    }
  }

  /**
   * Builds the pagination URL with ?start= parameter
   * here - it uses the start index like __url__?start=0 (for 1st page) and similarly - __url__?start=20 for the second page
   * Increment of 20 for every page - starting from 0
   */
  private buildPageUrl(pageNum: number): string {
    if (pageNum === 1) {
      return this.url;
    }
    
    const startIndex = (pageNum - 1) * this.jobsPerPage;
    const separator = this.url.includes('?') ? '&' : '?';
    return `${this.url}${separator}start=${startIndex}`;
  }

  /**
   * Scrapes job listings across all pages
   */
  async scrape(): Promise<ProspleJobListing[]> {
    const allJobs: ProspleJobListing[] = [];

    for (let pageNum = 1; pageNum <= this.totalPages; pageNum++) {
      console.log(`\n=== Scraping page ${pageNum} of ${this.totalPages} ===`);
      
      try {
        // navigate to the listing page
        const pageUrl = this.buildPageUrl(pageNum);
        console.log(`Navigating to: ${pageUrl}`);
        
        await this.page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });

        await this.delay(3000);
        await this.page.waitForSelector('section[role="button"]', { timeout: 20000 });

        // edxtract basic info from all job cards on this page
        const jobs = await this.page.$$eval(
          'section[role="button"]',
          (cards: Element[]): any[] => {
            return cards.map((card, index) => {
              const getText = (selector: string): string | undefined =>
                card.querySelector(selector)?.textContent?.trim();

              // Company
              const company = card.querySelector('img')?.getAttribute('alt') || getText('p');

              // Title and URL
              const titleLink = card.querySelector('h2 a');
              const title = titleLink?.textContent?.trim();
              const url = titleLink?.getAttribute('href');

              // Location
              const locationEl = Array.from(card.querySelectorAll('p')).find(p => 
                p.textContent?.includes(',') || p.textContent?.includes('Online')
              );
              const location = locationEl?.textContent?.trim();

              // Salary
              const salary = getText('span[class*="hPQoxt"]');

              // Start date
              const startDate = getText('div.field-item');

              return {
                title,
                company,
                location,
                salary,
                startDate,
                url: url ? `https://au.prosple.com${url}` : undefined,
              };
            });
          }
        );

        console.log(`Found ${jobs.length} jobs on page ${pageNum}`);

        // click each card and extract from side panel
        for (let j = 0; j < jobs.length; j++) {
          const job = jobs[j];
          // TODO: Add logging here  
          const details = await this.getJobDetailsFromSidePanel(j);
          jobs[j] = { ...job, ...details };
          
          await this.page.keyboard.press('Escape');
          await this.delay(800);
        }

        allJobs.push(...jobs);
        
      } catch (error) {
        console.error(`Error scraping page ${pageNum}:`, error);
      }
    }


    return allJobs;
  }

  async close() {
    await this.page.close();
  }
}

export default ProspelScrapper
