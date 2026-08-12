# Web Scraper

A JavaScript web scraper built for practicing responsible and controlled web scraping using the Books to Scrape sandbox.

## Target Classification

### Target Website

The target website for this project is:

**https://books.toscrape.com/**

Books to Scrape is a fictional bookstore specifically designed as a web-scraping practice environment. The parent website, ToScrape, describes the Books section as a safe place for beginners to learn web scraping and explicitly states that the site wants to be scraped.

The Books to Scrape website itself also displays the message **"We love being scraped!"**, confirming that it is intentionally provided for scraping practice.

### Why This Site Is Appropriate

This website is appropriate for this project because it is explicitly designed as a sandbox for web-scraping practice. It contains fictional book data and identifies itself as a demo website for scraping purposes.

The website also states that its prices and ratings are randomly assigned and have no real meaning, making it suitable for experimentation without relying on real commercial data.

### Scraping Scope

The scraper will be limited to:

* The first **3 catalogue pages** only.
* Approximately **60 book detail pages** in total.
* No pages outside this defined scope will be scraped.

The scraper will follow the book links from these catalogue pages to collect the required details from the individual book pages.

### Data to Be Collected

For each book, the scraper will collect the following information:

* **Title**
* **Price**
* **Availability**
* **Rating**
* **Description**

No additional data outside this defined scope is required.

### robots.txt Check

The following robots.txt URL was checked:

`https://books.toscrape.com/robots.txt`

The result was:

**404 Not Found**

This means that there is no robots.txt file available at that location. This result is not treated as permission to scrape the website. The justification for using this website comes from its explicit statements that it is a scraping sandbox and that it is intended to be scraped.

### Responsible Scraping

This project is intentionally limited to the Books to Scrape sandbox and to the first three catalogue pages. The scraper will not be assumed to be appropriate for other websites simply because this site permits scraping.

**I will not reuse this code on another site without checking its rules and terms first.**

## Project Structure

```text
scraper/
├── README.md
├── .gitignore
└── src/
    └── index.js
```

## Notes

This project is for learning and demonstrating responsible web-scraping practices. The target website contains fictional/demo data intended for scraping exercises.