/**
 * Demo prompts for the judges. Each one describes a small single-page static
 * website. The backend detects the "static site" shape of the prompt and runs
 * a fast-lane flow: one DeepSeek call → index.html + styles.css + script.js
 * land in the CODE tab, and index.html renders in the PREVIEW tab.
 *
 * Keep the wording plain English. The detector looks for phrases like
 * "single-page", "landing page", "portfolio", "static page", "html page" etc.,
 * so every prompt below contains at least one of those tokens near the top.
 */

export interface DemoPrompt {
  id: string
  title: string
  subtitle: string
  prompt: string
  estTokens: number
  estSeconds: number
  tag: "WEB" | "UI" | "PAGE"
}

export const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: "landing_coffee",
    title: "Coffee Shop Landing",
    subtitle: "One-page landing site for a small cafe",
    prompt:
      "A simple single-page static landing website for a small neighborhood coffee shop called 'Ember & Bean'. The page should include a hero section with the shop name and a one-line tagline, a short about paragraph, a small menu listing 4 drinks with prices, and a footer with an address and opening hours. Clean, warm, cozy design.",
    estTokens: 2500,
    estSeconds: 30,
    tag: "WEB",
  },
  {
    id: "portfolio_card",
    title: "Personal Portfolio",
    subtitle: "Minimalist single-card developer portfolio",
    prompt:
      "A single-page static portfolio website for a developer named 'Alex Morgan'. Show a centered card with the name, the job title 'Full-stack Developer', a two-sentence bio, three skill pills (TypeScript, Python, React), and three text links labelled GitHub, LinkedIn and Email. Modern, minimal, dark palette.",
    estTokens: 2200,
    estSeconds: 25,
    tag: "UI",
  },
  {
    id: "countdown",
    title: "Event Countdown",
    subtitle: "Live countdown to a fixed event",
    prompt:
      "A single-page static countdown website for an event titled 'Launch Day'. Hard-code a target date fourteen days from today in script.js. Show a live-updating display of days, hours, minutes and seconds remaining inside a centered card. Use vanilla JS and setInterval.",
    estTokens: 2400,
    estSeconds: 30,
    tag: "PAGE",
  },
  {
    id: "quote_of_day",
    title: "Quote of the Day",
    subtitle: "Shuffles a new quote on button click",
    prompt:
      "A single-page static website that shows a 'quote of the day'. Hard-code an array of 5 quote objects ({ text, author }) in script.js. Display one quote centered on the page inside a card, and a 'New quote' button that picks a different random quote each click.",
    estTokens: 2200,
    estSeconds: 25,
    tag: "UI",
  },
  {
    id: "todo_local",
    title: "Todo List",
    subtitle: "Add / complete / delete tasks in the browser",
    prompt:
      "A single-page static todo list website. Use vanilla JS and localStorage in the browser — no backend. Let the user type a task into an input, press Enter or click 'Add' to append it, click a checkbox to mark it done (strike-through style), and click an X to delete it. Persist everything in localStorage so it survives a reload.",
    estTokens: 2800,
    estSeconds: 30,
    tag: "WEB",
  },
  {
    id: "product_card",
    title: "Product Card",
    subtitle: "E-commerce product detail card",
    prompt:
      "A single-page static website showing one e-commerce product detail card. Hard-code one product: name 'Minimalist Desk Lamp', price $49, a two-line description, rating 4.6/5. Show an image placeholder (a colored div), the name, price, a 5-star rating row using unicode stars, the description, and an 'Add to cart' button. Clicking the button shows a short toast message 'Added to cart' for 2 seconds.",
    estTokens: 2600,
    estSeconds: 30,
    tag: "WEB",
  },
  {
    id: "gym_minimal",
    title: "Minimalist Gym Website",
    subtitle: "One-page landing site for a modern gym",
    prompt:
      "A simple minimalist single-page static website for a modern gym called 'IRON & OAK'. Render real content on first paint — nothing should be empty. Include: a hero section with the gym name, a one-line promise ('Train smart. Recover harder.') and a 'Join now' call-to-action button; a short 2-sentence about paragraph; three feature cards for Strength, Cardio and Recovery (each with an emoji glyph and 1-sentence description); a pricing row with three tiers (Starter $29/mo, Pro $59/mo, Elite $99/mo) each listing three perks; a 3-row weekly class schedule table (class name, day, time); and a footer with opening hours (Mon–Fri 6 AM–10 PM, Sat–Sun 8 AM–8 PM) and an address line. Use a dark base with lime/yellow accents and strong sans-serif typography. The page must look great on mobile and desktop.",
    estTokens: 3200,
    estSeconds: 35,
    tag: "WEB",
  },
]
