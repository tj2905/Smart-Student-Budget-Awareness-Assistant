
# 🧠 Simple Code Explanations (For Students)

### 1. `App.tsx` (The Heart)
This file holds all the "State"—which is just a fancy word for data that changes.
- **`useState`**: Used to remember your expenses and your budget limit.
- **`useEffect`**: Used as a "Trigger". Whenever the list of expenses changes, we save it to the browser's memory (LocalStorage) so it stays there even if you refresh the page.

### 2. `geminiService.ts` (The Brain)
This file talks to the AI. 
- It takes your list of expenses, turns them into a single long string of text, and asks Gemini: "Hey, give this student some advice."
- It uses the `@google/genai` library to make this conversation happen.

### 3. `types.ts` (The Blueprint)
This defines what an "Expense" looks like. In TypeScript, we use this to ensure we don't accidentally try to add a "Name" where a "Number" should be. It prevents bugs before they happen.

### 4. `localStorage` (The Memory)
Instead of a database like SQL, we use `localStorage`. It’s like a small notebook inside your web browser. It’s perfect for hackathons because it doesn't require setting up a server!

### 5. `Recharts` (The Artist)
This library takes your raw numbers and draws the Pie and Bar charts automatically. We just give it an array of data, and it handles the math for the angles and heights.
