import { Page } from "puppeteer";
import { SeekJobListing } from "../types/types";

export async function scrapeSeekJobs(page: Page, url: string): Promise<SeekJobListing[]> {
  await page.goto(url, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  const jobs = await page.$$eval('article[data-testid="job-card"]', (cards: Element[]) => {
    return cards.map(card => ({
      jobId: card.getAttribute('data-job-id'),
      title: card.querySelector('a[data-automation="jobTitle"]')?.textContent?.trim(),
      company: card.querySelector('[data-automation="jobCompany"]')?.textContent?.trim(),
      locations: Array.from(card.querySelectorAll('span[data-automation="jobLocation"]')).map(el => el.textContent?.trim() || ''),
      workArrangement: card.querySelector('[data-testid="work-arrangement"]')?.textContent?.trim(),
      salary: card.querySelector('span[data-automation="jobSalary"]')?.textContent?.trim(),
      description: card.querySelector('span[data-automation="jobShortDescription"]')?.textContent?.trim(),
      listingDate: card.querySelector('span[data-automation="jobListingDate"]')?.textContent?.trim(),
      url: card.querySelector('a[data-automation="job-list-item-link-overlay"]')?.getAttribute('href'),
      isPremium: card.getAttribute('data-automation') === 'premiumJob',
      classification: card.querySelector('span[data-automation="jobClassification"]')?.textContent?.trim(),
      subClassification: card.querySelector('span[data-automation="jobSubClassification"]')?.textContent?.trim()
    }));
  });

  return jobs as SeekJobListing[];
}
