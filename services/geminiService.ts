
import { GoogleGenAI } from "@google/genai";
import { Expense, Budget } from "../types";

export const getAIInsights = async (expenses: Expense[], budget: Budget): Promise<string> => {
  if (expenses.length === 0) return "Add some expenses to see AI-powered financial advice!";

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
  const remaining = budget.monthlyLimit - totalSpent;
  
  // Format data for prompt
  const expenseSummary = expenses.map(e => `${e.timestamp}: ${e.category} - ₹${e.amount} (${e.note})`).join('\n');

  const prompt = `
    As a student financial mentor in India, analyze these university expenses and provide 3-4 bullet points of concise, actionable advice.
    Currency: Indian Rupee (₹)
    Monthly Budget: ₹${budget.monthlyLimit}
    Total Spent: ₹${totalSpent}
    Remaining: ₹${remaining}
    
    Expenses:
    ${expenseSummary}
    
    Keep it friendly, student-centric, and encouraging. Focus on typical Indian student spending patterns (like eating out, transport, mobile recharges) and saving tips.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.8,
      },
    });

    return response.text || "I couldn't generate insights right now. Keep an eye on your spending!";
  } catch (error) {
    console.error("Gemini Insight Error:", error);
    return "AI Insights currently unavailable. Tip: Try to limit 'Entertainment' spending this week!";
  }
};
