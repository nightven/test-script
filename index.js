const puppeteer = require("puppeteer");
const winston = require("winston");
const AntiCaptcha = require("anti-captcha"); 
require("dotenv").config();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [new winston.transports.File({ filename: "out.log" })],
});

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto("https://www.linkedin.com/login/ru");
    logger.info("Відкрито сторінку входу");

    await page.type("#username", process.env.EMAIL);
    await page.type("#password", process.env.PASSWORD);
    logger.info("Введено облікові дані");

    await Promise.all([
      page.click(".btn__primary--large.from__button--floating"),
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
    ]);
    logger.info("Натиснуто кнопку входу");

    
    const captchaExists = await page.$(".captcha-class");
    if (captchaExists) {
      logger.warn("reCAPTCHA виявлено, намагаємося обійти");

      const antiCaptcha = new AntiCaptcha(process.env.CAPTCHA_API_KEY);
      const taskId = await antiCaptcha.createTask({
        type: "NoCaptchaTaskProxyless",
        websiteURL: page.url(),
        websiteKey: "site_key",  //Так як в мен не відкривалась каптча, я не зміг знайти ключ сайту
      });

      const result = await antiCaptcha.waitForResult(taskId);
      if (result) {
        logger.info("CAPTCHA успішно обійдено.");

        
        await page.evaluate((token) => {
          document.querySelector("input[name='g-recaptcha-response']").value =
            token;
        }, result);

       
        await page.click(".btn__primary--large.from__button--floating");
      }
    }

    await page.waitForSelector("img.feed-identity-module__member-photo", {
      timeout: 30000,
    });

    logger.info("Вхід виконано успішно");

    const profileImageUrl = await page.$eval(
      "img.feed-identity-module__member-photo",
      (el) => el.src
    );
    logger.info(`URL зображення профілю: ${profileImageUrl}`);
  } catch (error) {
    logger.error(`Помилка: ${error.message}`);
  } finally {
    await browser.close();
  }
})();
