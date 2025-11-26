import { Page } from "puppeteer";
declare class Scrapper {
    private browser;
    private seekPage;
    constructor();
    init_browser(): Promise<void>;
    initializeSeekPage(): Promise<void>;
    getSeekPage(): Page;
    closeSeekPage(): Promise<void>;
    close(): Promise<void>;
}
export { Scrapper };
//# sourceMappingURL=Scrapper.d.ts.map