
const cheerio = require("cheerio");

function extractBookRecord(html, productUrl, sourcePage, fetchedAt) {
    const $ = cheerio.load(html);
    const productArea = $("article.product_page");
    const title = productArea.find("div.product_main h1").first().text().trim() || null;
    const priceText = productArea.find("p.price_color").first().text().trim() || null;
    const availabilityText = productArea.find("p.instock.availability").first().text().replace(/\s+/g, " ").trim() || null;
    const ratingText = productArea.find("p.star-rating").first().attr("class")?.replace("star-rating", "").trim() || null;
    const description = $("#product_description").next("p").first().text().trim() || null;

    return { title, product_url: productUrl, price_text: priceText, availability_text: availabilityText, rating_text: ratingText, description, source_page: sourcePage, fetched_at: fetchedAt };
}

module.exports = {
    extractBookRecord,
};