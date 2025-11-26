import puppeteer, { Browser, Page } from "puppeteer";
import { scrapeSeekJobs } from "./scrappers/seekScrapper";

class Scrapper {
  private browser: Browser | null = null;
  private seekPage: Page | null = null;

  constructor() {
  }

  async init_browser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: true,
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

  getSeekPage(): Page {
    if (!this.seekPage) {
      throw new Error('Seek page not initialized. Call initializeSeekPage() first.');
    }
    return this.seekPage;
  }

  async closeSeekPage(): Promise<void> {
    if (this.seekPage) {
      await this.seekPage.close();
      this.seekPage = null;
    }
  }

  async close(): Promise<void> {
    await this.closeSeekPage();
    if (this.browser) {
      await this.browser.close();
    }
  }
}

export { Scrapper };
