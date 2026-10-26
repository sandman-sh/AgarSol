import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        # @@ts-step {"i":1,"type":"action","action":"navigate","selector":null,"desc":"Navigate to https://agar-sol.vercel.app/","input":"https://agar-sol.vercel.app/","field":null}
        await page.goto("https://agar-sol.vercel.app/")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Enter “QA Guest” in the GUEST NICKNAME field and verify it appears there.
        # @@ts-step {"i":2,"type":"action","action":"fill","selector":"xpath=/html/body/div/div/div[4]/div/div[3]/div[2]/div/div/div[4]/div[2]/input","desc":"Fill 'QA Guest' into Enter Nickname text field","input":"QA Guest","field":"67"}
        # Enter Nickname text field
        elem = page.get_by_role("textbox", name="Enter Nickname")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("QA Guest")
        
        # -> Click “PLAY AS GUEST (FREE)” and verify that the start menu closes and the in-game HUD shows player mass and the active arena canvas.
        # @@ts-step {"i":3,"type":"action","action":"click","selector":"xpath=/html/body/div/div/div[4]/div/div[3]/div[2]/div/div[2]/div[2]/button","desc":"Click 'PLAY AS GUEST (FREE) button'","input":null,"field":"88"}
        # PLAY AS GUEST (FREE) button
        elem = page.get_by_role("button", name="PLAY AS GUEST (FREE)")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The active arena is visible after guest play starts.
        await page.locator("xpath=/html/body/div[1]/div/div[1]/div/svg").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The active arena should be visible.
        await expect(page.locator("xpath=/html/body/div[1]/div/div[1]/div/svg").nth(0)).to_be_visible(timeout=15000), "The active arena should be visible."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    