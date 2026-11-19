# Food Hunt: Selenium + JUnit test cases

CS 495 Capstone, team **The Creators**. Ten automated UI tests for the Food Hunt web app
(live demo: http://3.136.170.216/), written with **JUnit 5** and **Selenium WebDriver 4** (Chrome).

All ten tests are in `src/test/java/edu/tamut/thecreators/foodhunt/FoodHuntTest.java`.

| # | Test case | What it checks |
|---|---|---|
| TC01 | Home page loads | Page title, brand, hero heading, empty search box |
| TC02 | Default listing | Places are listed and the heading count equals the number of cards |
| TC03 | Craving search | "tacos" returns matches and the spotlight shows the closest one |
| TC04 | Typo correction | "tocos" is corrected to "tacos" and the user is told |
| TC05 | Popular quick idea | Clicking "sushi" fills the search box and runs the search |
| TC06 | No results | A nonsense craving shows the empty state; "Clear search" restores the list |
| TC07 | Category tab | "Sip" filters the list to the count shown on the tab |
| TC08 | Sort control | Switching "Closest" / "Top rated" keeps the same places |
| TC09 | Place drawer | Clicking a card opens that place's details; Escape closes it |
| TC10 | Invalid sign-in | A wrong password shows an error and the user stays signed out |

The tests only read data. They do not create accounts, reviews or meetups.

## Run in Eclipse

1. File > Import > General > Existing Projects into Workspace, then pick this folder (or the zip).
2. Wait for Maven to download Selenium and JUnit (first time only).
3. Right-click `FoodHuntTest.java` > Run As > JUnit Test.

You need Google Chrome and Java 17 or newer. Selenium downloads the matching ChromeDriver by itself.

## Run from a terminal

```bash
mvn test                                        # opens Chrome
mvn test -Dheadless=true                        # no browser window
mvn test -DbaseUrl=http://localhost:5173/       # test a local build instead
```
