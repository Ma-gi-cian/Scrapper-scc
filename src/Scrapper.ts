import puppeteer, { Browser, Page } from "puppeteer";
import SeekScrapper from "./scrappers/seekScrapper.js";
import {SeekJobListing} from '../src/types/types'

class Scrapper {
  private browser: Browser | null = null;
  private seekPage: Page | null = null;

  constructor() {
  }

  async init_browser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: false,
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

  async initializeSeekPage(): Promise<void> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call init_browser() first.');
    }

    this.seekPage = await this.browser.newPage();

    // Set viewport
    await this.seekPage.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });

    await this.seekPage.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    await this.seekPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5]
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en']
      });

      // Add chrome property
      (window as any).chrome = {
        runtime: {}
      };

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: (Notification as any).permission } as any) :
          originalQuery(parameters)
      );
    });
  }

  async initPages(): Promise<void>{
    if (!this.browser){
      throw new Error('Browser not initialized')
    }

    this.seekPage = await this.browser.newPage();
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  async init_scrapers() {
    if (!this.seekPage) {
      throw new Error('Seek page not initialized. Call initializeSeekPage() first.');
    }

    const seek = new SeekScrapper(this.seekPage, 'https://www.seek.com.au/software-engineer-jobs/remote');
    const data = await seek.run();

    data.forEach((element: SeekJobListing) => {
      console.log(element)
    });

  }
  
}

export default Scrapper
