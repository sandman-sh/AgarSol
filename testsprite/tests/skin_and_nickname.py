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
        
        # -> Open the “Change Skin (8 Available)” chooser and inspect the available skin choices.
        # @@ts-step {"i":2,"type":"action","action":"click","selector":"xpath=/html/body/div/div/div[4]/div/div[3]/div[2]/div/div/div[3]/button","desc":"Click 'Change Skin (8 Available) button'","input":null,"field":"80"}
        # Change Skin (8 Available) button
        elem = page.get_by_role("button", name="Change Skin (8 Available)")
        await elem.click(timeout=10000)
        
        # -> Select the GigaChad skin and verify the chooser closes and the play card shows Skin: GigaChad.
        # @@ts-step {"i":3,"type":"action","action":"click","selector":"xpath=/html/body/div/div/div[4]/div[2]/div/div[2]/div[8]/div","desc":"Click '\ud83d\uddff'","input":null,"field":"1140"}
        # 🗿
        elem = page.get_by_text("🗿")
        await elem.click(timeout=10000)
        
        # -> Replace the guest nickname with “QA NomNom” and verify that value appears in the nickname field.
        # @@ts-step {"i":4,"type":"action","action":"fill","selector":"xpath=/html/body/div/div/div[4]/div/div[3]/div[2]/div/div/div[4]/div[2]/input","desc":"Fill 'QA NomNom' into Enter Nickname text field","input":"QA NomNom","field":"67"}
        # Enter Nickname text field
        elem = page.get_by_role("textbox", name="Enter Nickname")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("QA NomNom")
        
        # --> Assertions to verify final state
        
        # --> The play card shows the selected GigaChad skin.
        await page.get_by_title("Click to view all skins").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The selected skin is visible on the play card.
        await expect(page.get_by_title("Click to view all skins").nth(0)).to_be_visible(timeout=15000), "The selected skin is visible on the play card."
        
        # --> The nickname input shows QA NomNom.
        # Assert-outcome: not verified — the export-time check could not be evaluated
        # Assert: The nickname input contains QA NomNom.
        await expect(page.get_by_role("textbox", name="Enter Nickname").nth(0)).to_have_value("QA NomNom", timeout=15000), "The nickname input contains QA NomNom."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    