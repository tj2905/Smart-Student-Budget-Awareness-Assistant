
import { GoogleGenAI } from "@google/genai";
import { Expense, Budget } from "../types";

export const getAIInsights = async (expenses: Expense[], budget: Budget): Promise<string> => {
  if (expenses.length === 0) return "Log your first few expenses to unlock hyper-personalized AI financial coaching!";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget.monthlyLimit - totalSpent;
  
  const expenseSummary = expenses.map(e => `${e.timestamp}: ${e.category} - ₹${e.amount} (${e.note})`).join('\n');

  const prompt = `
    As a high-level student financial strategist in India, analyze these expenses.
    
    CONTEXT:
    Currency: INR (₹)
    Monthly Budget: ₹${budget.monthlyLimit}
    Total Spent: ₹${totalSpent}
    Remaining: ₹${remaining}
    
    EXPENSE LOG:
    ${expenseSummary}
    
    TASK:
    1. Identify the single biggest "leak" in their budget.
    2. Provide 2-3 specific, actionable tips. 
    3. Use Google Search to find current student-specific discounts or saving hacks relevant to their highest spending categories in India (e.g., Zomato Gold student packs, Unidays deals, or transport passes).
    
    Keep the tone professional yet encouraging.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.7,
      },
    });

    return response.text || "Analysis complete. Recommendation: Keep an eye on impulsive 'Entertainment' spending to stay within your ₹" + budget.monthlyLimit + " limit.";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "The AI mentor is briefly offline. Quick Tip: Check for student discounts on public transport to lower your monthly costs!";
  }
};
