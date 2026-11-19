package edu.tamut.thecreators.foodhunt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

/**
 * Automated UI test cases for Food Hunt (CS 495 Capstone, team The Creators).
 *
 * Frameworks: JUnit 5 + Selenium WebDriver 4 (Chrome).
 *
 * The tests run against the deployed app. To point them somewhere else
 * (for example a local build), pass -DbaseUrl=http://localhost:5173/.
 * Pass -Dheadless=true to run without opening a browser window.
 *
 * Every test only reads data: no accounts, reviews or meetups are created.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class FoodHuntTest {

    private static final String BASE_URL = System.getProperty("baseUrl", "http://3.136.170.216/");
    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    private static final By HERO_TITLE = By.id("hero-title");
    private static final By SEARCH_BOX = By.id("q");
    private static final By SEARCH_BUTTON = By.cssSelector("form.search button[type='submit']");
    private static final By RESULTS_HEADING = By.cssSelector(".places__head h2");
    private static final By PLACE_CARDS = By.cssSelector("article.card");
    private static final By EMPTY_STATE = By.cssSelector(".places .empty");

    private WebDriver driver;
    private WebDriverWait wait;

    @BeforeEach
    void openHomePage() {
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--window-size=1366,900");
        // The demo server is plain http, so stop Chrome from trying https first.
        options.addArguments("--disable-features=HttpsUpgrades,HttpsFirstBalancedModeAutoEnable");
        if (Boolean.getBoolean("headless")) {
            options.addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage");
        }
        driver = new ChromeDriver(options);
        wait = new WebDriverWait(driver, TIMEOUT);

        driver.get(BASE_URL);
        // The first search (everything near Texarkana) has finished once cards are on the page.
        wait.until(ExpectedConditions.numberOfElementsToBeMoreThan(PLACE_CARDS, 0));
    }

    @AfterEach
    void closeBrowser() {
        if (driver != null) {
            driver.quit();
        }
    }

    // ---------------------------------------------------------------- helpers

    /** Types a craving in the search box and submits the form. */
    private void searchFor(String craving) {
        WebElement box = driver.findElement(SEARCH_BOX);
        box.clear();
        box.sendKeys(craving);
        driver.findElement(SEARCH_BUTTON).click();
    }

    private String waitForHeadingContaining(String text) {
        wait.until(ExpectedConditions.textToBePresentInElementLocated(RESULTS_HEADING, text));
        return driver.findElement(RESULTS_HEADING).getText();
    }

    /** Reads the first whole number in a piece of text, e.g. "14 places for tacos" gives 14. */
    private static int firstNumberIn(String text) {
        Matcher m = Pattern.compile("\\d+").matcher(text);
        assertTrue(m.find(), "Expected a number in: " + text);
        return Integer.parseInt(m.group());
    }

    private WebElement buttonWithText(By scope, String text) {
        for (WebElement button : driver.findElements(scope)) {
            if (button.getText().contains(text)) {
                return button;
            }
        }
        throw new AssertionError("No button containing \"" + text + "\" found for " + scope);
    }

    // ------------------------------------------------------------- test cases

    @Test
    @Order(1)
    @DisplayName("TC01 Home page loads with the brand, title and craving search box")
    void tc01_homePageLoads() {
        assertTrue(driver.getTitle().contains("Food Hunt"), "Page title should mention Food Hunt");
        assertEquals("What are you craving?", driver.findElement(HERO_TITLE).getText());
        assertTrue(driver.findElement(By.cssSelector("a.brand")).getText().contains("Food Hunt"));

        WebElement box = driver.findElement(SEARCH_BOX);
        assertTrue(box.isDisplayed(), "Search box should be visible");
        assertEquals("", box.getAttribute("value"), "Search box should start empty");
    }

    @Test
    @Order(2)
    @DisplayName("TC02 Default listing shows local places and the heading count matches the cards")
    void tc02_defaultListingMatchesHeadingCount() {
        String heading = waitForHeadingContaining("local spots nearby");
        int cards = driver.findElements(PLACE_CARDS).size();

        assertTrue(cards > 0, "At least one place should be listed");
        assertEquals(firstNumberIn(heading), cards, "Heading count should equal the number of cards");
    }

    @Test
    @Order(3)
    @DisplayName("TC03 Searching for a craving shows matching places and the closest one in the spotlight")
    void tc03_cravingSearchShowsResultsAndSpotlight() {
        searchFor("tacos");

        String heading = waitForHeadingContaining("for tacos near you");
        int cards = driver.findElements(PLACE_CARDS).size();
        assertTrue(cards > 0, "Tacos should have at least one match");
        assertEquals(firstNumberIn(heading), cards);

        WebElement spotlight = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("section.spot")));
        assertEquals("closest tacos", spotlight.findElement(By.cssSelector(".spot__stamp")).getText().toLowerCase());
        assertFalse(spotlight.findElement(By.id("spot-title")).getText().isBlank(), "Spotlight should name a place");
    }

    @Test
    @Order(4)
    @DisplayName("TC04 A misspelled craving is corrected and the user is told")
    void tc04_typoIsCorrected() {
        searchFor("tocos");

        WebElement note = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector("p.fixed-typo")));
        assertTrue(note.getText().contains("Showing results for tacos"), "Note was: " + note.getText());
        assertTrue(note.getText().contains("tocos"), "Note should repeat what the user typed");
        waitForHeadingContaining("for tacos near you");
    }

    @Test
    @Order(5)
    @DisplayName("TC05 A 'Popular' quick idea fills the search box and runs the search")
    void tc05_popularIdeaRunsSearch() {
        buttonWithText(By.cssSelector("button.idea"), "sushi").click();

        waitForHeadingContaining("for sushi near you");
        assertEquals("sushi", driver.findElement(SEARCH_BOX).getAttribute("value"));
        assertTrue(driver.findElements(PLACE_CARDS).size() > 0, "Sushi should have at least one match");
    }

    @Test
    @Order(6)
    @DisplayName("TC06 A craving nobody serves shows the empty state, and 'Clear search' restores the list")
    void tc06_noResultsThenClearSearch() {
        searchFor("zzzzqqq");

        WebElement empty = wait.until(ExpectedConditions.visibilityOfElementLocated(EMPTY_STATE));
        assertTrue(empty.getText().contains("No place nearby has zzzzqqq yet"), "Message was: " + empty.getText());
        assertEquals(0, driver.findElements(PLACE_CARDS).size(), "No cards expected for a nonsense craving");

        buttonWithText(By.cssSelector(".empty button"), "Clear search").click();

        wait.until(ExpectedConditions.numberOfElementsToBeMoreThan(PLACE_CARDS, 0));
        assertEquals("", driver.findElement(SEARCH_BOX).getAttribute("value"), "Search box should be cleared");
        waitForHeadingContaining("local spots nearby");
    }

    @Test
    @Order(7)
    @DisplayName("TC07 The 'Sip' category tab filters the list to the number shown on the tab")
    void tc07_categoryTabFiltersPlaces() {
        int allPlaces = driver.findElements(PLACE_CARDS).size();
        WebElement sipTab = buttonWithText(By.cssSelector("button[role='tab']"), "Sip");
        int expected = Integer.parseInt(sipTab.findElement(By.cssSelector(".tab__n")).getText().trim());

        sipTab.click();

        String heading = waitForHeadingContaining("Sip:");
        assertEquals("true", sipTab.getAttribute("aria-selected"), "Sip tab should be selected");
        assertEquals(expected, driver.findElements(PLACE_CARDS).size(), "Cards should match the tab count");
        assertEquals(expected, firstNumberIn(heading), "Heading should match the tab count");
        assertTrue(expected < allPlaces, "Sip should be a subset of all places");
    }

    @Test
    @Order(8)
    @DisplayName("TC08 The sort control switches between 'Closest' and 'Top rated'")
    void tc08_sortToggle() {
        By sortButtons = By.cssSelector(".sort button");
        WebElement closest = buttonWithText(sortButtons, "Closest");
        WebElement topRated = buttonWithText(sortButtons, "Top rated");
        int before = driver.findElements(PLACE_CARDS).size();

        assertEquals("true", closest.getAttribute("aria-pressed"), "Closest is the default sort");
        assertEquals("false", topRated.getAttribute("aria-pressed"));

        topRated.click();

        wait.until(ExpectedConditions.attributeToBe(topRated, "aria-pressed", "true"));
        assertEquals("false", closest.getAttribute("aria-pressed"));
        assertEquals(before, driver.findElements(PLACE_CARDS).size(), "Sorting must not add or remove places");
    }

    @Test
    @Order(9)
    @DisplayName("TC09 Clicking a place card opens its detail drawer, and Escape closes it")
    void tc09_placeDrawerOpensAndCloses() {
        WebElement firstCard = driver.findElement(PLACE_CARDS);
        String placeName = firstCard.findElement(By.tagName("h3")).getText();

        firstCard.findElement(By.cssSelector("button.card__hit")).click();

        By drawer = By.cssSelector("[role='dialog']");
        WebElement title = wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("drawer-title")));
        assertEquals(placeName, title.getText(), "Drawer should show the place that was clicked");

        List<WebElement> sections = driver.findElements(By.cssSelector("[role='dialog'] .drawer__block h3"));
        assertTrue(sections.stream().anyMatch(h -> h.getText().startsWith("Reviews")), "Drawer should have a Reviews section");

        new Actions(driver).sendKeys(Keys.ESCAPE).perform();
        wait.until(ExpectedConditions.invisibilityOfElementLocated(drawer));
    }

    @Test
    @Order(10)
    @DisplayName("TC10 Signing in with a wrong password is rejected with an error, and the user stays signed out")
    void tc10_invalidSignInIsRejected() {
        buttonWithText(By.cssSelector(".topbar__account button"), "Sign in").click();

        WebElement title = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".auth-card h2")));
        assertEquals("Welcome Back", title.getText());

        driver.findElement(By.name("email")).sendKeys("selenium-no-such-user@example.com");
        driver.findElement(By.name("password")).sendKeys("not-the-password");
        driver.findElement(By.cssSelector("button.auth-submit")).click();

        WebElement error = wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(".auth-card [role='alert']")));
        assertFalse(error.getText().isBlank(), "An error message should be shown");
        assertEquals("Welcome Back", driver.findElement(By.cssSelector(".auth-card h2")).getText(), "Still on the sign-in screen");

        buttonWithText(By.cssSelector("button.auth-back"), "Back to Home").click();
        wait.until(ExpectedConditions.visibilityOfElementLocated(HERO_TITLE));
        assertTrue(buttonWithText(By.cssSelector(".topbar__account button"), "Sign in").isDisplayed(), "User should still be signed out");
    }
}
