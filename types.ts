
export enum Category {
  FOOD = 'Food & Drinks',
  TRANSPORT = 'Transport',
  BOOKS = 'Books & Study',
  ENTERTAINMENT = 'Entertainment',
  RENT = 'Rent & Utilities',
  OTHER = 'Other'
}

export interface Expense {
  id: string;
  amount: number;
  category: Category;
  note: string;
  timestamp: string;
}

export interface Budget {
  monthlyLimit: number;
}

export interface AppState {
  expenses: Expense[];
  budget: Budget;
}
